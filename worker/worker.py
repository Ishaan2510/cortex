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

app_env = os.getenv('APP_ENV', 'local')
env_file = '.env.docker' if app_env == 'docker' else '.env.local'
env_path = Path(__file__).resolve().parent / env_file
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
)
logger = logging.getLogger(__name__)

MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/aitaskplatform')
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379')
QUEUE_NAME = 'task_queue'

mongo_client = MongoClient(MONGO_URI, server_api=ServerApi('1'))
db = mongo_client['aitaskplatform']
tasks_col = db['tasks']

redis_client = redis.from_url(REDIS_URL, decode_responses=True)


def process_operation(operation: str, input_text: str) -> str:
    if operation == 'uppercase':
        return input_text.upper()
    elif operation == 'lowercase':
        return input_text.lower()
    elif operation == 'reverse':
        return input_text[::-1]
    elif operation == 'word_count':
        count = len(input_text.split())
        return f'{count} word{"s" if count != 1 else ""}'
    else:
        raise ValueError(f'Unknown operation: {operation}')


def handle_task(task_id: str):
    task = tasks_col.find_one({'_id': ObjectId(task_id)})
    if not task:
        logger.error(f'Task {task_id} not found in DB')
        return

    logs = [f'[{datetime.now(timezone.utc).isoformat()}] Task picked up by worker']

    # Mark as running
    tasks_col.update_one(
        {'_id': ObjectId(task_id)},
        {'$set': {'status': 'running', 'logs': logs}},
    )

    try:
        logs.append(f'[{datetime.now(timezone.utc).isoformat()}] Running operation: {task["operation"]}')
        result = process_operation(task['operation'], task['inputText'])
        logs.append(f'[{datetime.now(timezone.utc).isoformat()}] Operation completed successfully')

        tasks_col.update_one(
            {'_id': ObjectId(task_id)},
            {'$set': {'status': 'success', 'result': result, 'logs': logs}},
        )
        logger.info(f'Task {task_id} completed successfully')

    except Exception as e:
        logs.append(f'[{datetime.now(timezone.utc).isoformat()}] ERROR: {str(e)}')
        tasks_col.update_one(
            {'_id': ObjectId(task_id)},
            {'$set': {'status': 'failed', 'logs': logs}},
        )
        logger.error(f'Task {task_id} failed: {e}')


def main():
    logger.info('Worker started, waiting for tasks...')
    while True:
        try:
            # Blocking pop — waits up to 5s for a job
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