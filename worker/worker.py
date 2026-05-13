import os
import time
import logging
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv
import redis
from pymongo import MongoClient
from pymongo.server_api import ServerApi
from bson import ObjectId
from dotenv import load_dotenv

load_dotenv('.env.local')

app_env = os.getenv('APP_ENV', 'local')
env_file = '.env.docker' if app_env == 'docker' else '.env.local'
env_path = Path(__file__).resolve().parent / env_file
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()


from llm_router import route_and_call
from operations import get_system_prompt, get_operation_label
from file_processor import extract_pdf_text, get_image_base64

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
)
logger = logging.getLogger(__name__)

MONGO_URI = os.getenv('MONGO_URI')
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379')
QUEUE_NAME = 'task_queue'

mongo_uri = os.getenv('MONGO_URI', 'mongodb://localhost:27017/cortex')
mongo_client = MongoClient(mongo_uri)

db = mongo_client['aitaskplatform']
tasks_col = db['tasks']

redis_client = redis.from_url(REDIS_URL, decode_responses=True)


def ts() -> str:
    return f'[{datetime.now(timezone.utc).isoformat()}]'


def handle_task(task_id: str):
    task = tasks_col.find_one({'_id': ObjectId(task_id)})
    if not task:
        logger.error(f'Task {task_id} not found in DB')
        return

    logs = [f'{ts()} Task picked up by worker']
    operation = task.get('operation', 'custom')
    operation_label = get_operation_label(operation)

    tasks_col.update_one(
        {'_id': ObjectId(task_id)},
        {'$set': {'status': 'running', 'logs': logs}},
    )

    try:
        # Build user message from text + file
        user_message_parts = []
        image_data = None
        has_image = False

        file_url = task.get('fileUrl')
        file_type = task.get('fileType')

        if file_url and file_type == 'pdf':
            logs.append(f'{ts()} Extracting text from PDF')
            tasks_col.update_one({'_id': ObjectId(task_id)}, {'$set': {'logs': logs}})
            pdf_text = extract_pdf_text(file_url)
            logs.append(f'{ts()} PDF extracted ({len(pdf_text)} characters)')
            user_message_parts.append(f'[PDF Content]\n{pdf_text}')

        elif file_url and file_type == 'image':
            logs.append(f'{ts()} Loading image for processing')
            tasks_col.update_one({'_id': ObjectId(task_id)}, {'$set': {'logs': logs}})
            image_data = get_image_base64(file_url)
            has_image = True
            user_message_parts.append('[An image has been provided. Please process it as instructed.]')

        input_text = task.get('inputText', '')
        if input_text:
            user_message_parts.append(f'[Text Input]\n{input_text}')

        user_message = '\n\n'.join(user_message_parts)
        input_length = len(user_message)

        system_prompt = get_system_prompt(
            operation,
            custom_prompt=task.get('customPrompt'),
        )

        logs.append(f'{ts()} Running operation: {operation_label}')
        logs.append(f'{ts()} Input length: {input_length} characters')
        tasks_col.update_one({'_id': ObjectId(task_id)}, {'$set': {'logs': logs}})

        result, providers_attempted = route_and_call(
            system_prompt=system_prompt,
            user_message=user_message,
            operation=operation,
            input_length=input_length,
            has_image=has_image,
            image_data=image_data,
        )

        provider_used = providers_attempted[-1]
        logs.append(f'{ts()} Completed using provider: {provider_used}')
        if len(providers_attempted) > 1:
            logs.append(f'{ts()} Fallback chain used: {" -> ".join(providers_attempted)}')

        tasks_col.update_one(
            {'_id': ObjectId(task_id)},
            {
                '$set': {
                    'status': 'success',
                    'result': result,
                    'providerUsed': provider_used,
                    'providerChain': providers_attempted,
                    'logs': logs,
                }
            },
        )
        logger.info(f'Task {task_id} completed via {provider_used}')

    except Exception as e:
        logs.append(f'{ts()} ERROR: {str(e)}')
        tasks_col.update_one(
            {'_id': ObjectId(task_id)},
            {'$set': {'status': 'failed', 'logs': logs}},
        )
        logger.error(f'Task {task_id} failed: {e}')


def main():
    logger.info('Cortex worker started, waiting for tasks...')
    while True:
        try:
            item = redis_client.brpop(QUEUE_NAME, timeout=5)
            if item:
                _, task_id = item
                logger.info(f'Picked up task: {task_id}')
                handle_task(task_id)
        except Exception as e:
            logger.error(f'Worker loop error: {e}')
            time.sleep(2)


if __name__ == '__main__':
    main()