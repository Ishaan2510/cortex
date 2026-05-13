import os
import logging
from enum import Enum

logger = logging.getLogger(__name__)

# Input length thresholds
SHORT_THRESHOLD = 3_000    # chars — fast tasks fine
LONG_THRESHOLD = 15_000   # chars — route to Gemini


class Provider(str, Enum):
    GROQ = 'groq'
    CEREBRAS = 'cerebras'
    GEMINI = 'gemini'
    OPENROUTER = 'openrouter'


# Operations that benefit from speed over context size
SPEED_OPERATIONS = {
    'summarize',
    'rewrite_formal',
    'rewrite_casual',
    'generate_linkedin_post',
    'draft_email',
    'generate_tweet_thread',
    'translate_hindi',
    'custom',
}

# Operations that benefit from deeper reasoning
REASONING_OPERATIONS = {
    'extract_action_items',
    'extract_key_decisions',
    'explain_simply',
}


def get_provider_chain(
    operation: str,
    input_length: int,
    has_image: bool,
) -> list[Provider]:
    """
    Returns an ordered list of providers to try.
    First in list is primary, rest are fallbacks.
    """
    # Images must go to Gemini — it's the only multimodal free option
    if has_image:
        return [Provider.GEMINI, Provider.OPENROUTER]

    # Long content routes to Gemini first for its 1M context window
    if input_length > LONG_THRESHOLD:
        return [Provider.GEMINI, Provider.CEREBRAS, Provider.OPENROUTER]

    # Reasoning operations — Groq first, Cerebras fallback
    if operation in REASONING_OPERATIONS:
        return [Provider.GROQ, Provider.CEREBRAS, Provider.GEMINI, Provider.OPENROUTER]

    # Speed operations (default) — Groq primary
    return [Provider.GROQ, Provider.CEREBRAS, Provider.GEMINI, Provider.OPENROUTER]


def call_groq(system_prompt: str, user_message: str) -> str:
    from groq import Groq
    client = Groq(api_key=os.getenv('GROQ_API_KEY'))
    response = client.chat.completions.create(
        model='llama-3.3-70b-versatile',
        messages=[
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_message},
        ],
        temperature=0.7,
        max_tokens=2048,
    )
    return response.choices[0].message.content


def call_cerebras(system_prompt: str, user_message: str) -> str:
    from cerebras.cloud.sdk import Cerebras
    client = Cerebras(api_key=os.getenv('CEREBRAS_API_KEY'))
    response = client.chat.completions.create(
        model='llama-3.3-70b',
        messages=[
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_message},
        ],
        temperature=0.7,
        max_tokens=2048,
    )
    return response.choices[0].message.content


def call_gemini(
    system_prompt: str,
    user_message: str,
    image_data: dict = None,
) -> str:
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=os.getenv('GOOGLE_API_KEY'))

    contents = []

    if image_data:
        contents.append(
            types.Part.from_bytes(
                data=image_data['data'],
                mime_type=image_data['mime_type'],
            )
        )

    contents.append(types.Part.from_text(text=user_message))

    response = client.models.generate_content(
        model='gemini-2.0-flash',
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.7,
            max_output_tokens=2048,
        ),
    )
    return response.text


def call_openrouter(system_prompt: str, user_message: str) -> str:
    from openai import OpenAI
    client = OpenAI(
        base_url='https://openrouter.ai/api/v1',
        api_key=os.getenv('OPENROUTER_API_KEY'),
    )
    response = client.chat.completions.create(
        model='meta-llama/llama-3.3-70b-instruct:free',
        messages=[
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_message},
        ],
        temperature=0.7,
        max_tokens=2048,
    )
    return response.choices[0].message.content


PROVIDER_CALLERS = {
    Provider.GROQ: call_groq,
    Provider.CEREBRAS: call_cerebras,
    Provider.GEMINI: call_gemini,
    Provider.OPENROUTER: call_openrouter,
}


def route_and_call(
    system_prompt: str,
    user_message: str,
    operation: str,
    input_length: int,
    has_image: bool = False,
    image_data: dict = None,
) -> tuple[str, list[str]]:
    """
    Returns (result_text, providers_attempted).
    Tries providers in order, falls back on rate limit or error.
    """
    chain = get_provider_chain(operation, input_length, has_image)
    attempted = []
    last_error = None

    for provider in chain:
        attempted.append(provider.value)
        try:
            logger.info(f'Trying provider: {provider.value}')
            if provider == Provider.GEMINI and image_data:
                result = call_gemini(system_prompt, user_message, image_data)
            else:
                caller = PROVIDER_CALLERS[provider]
                result = caller(system_prompt, user_message)
            logger.info(f'Success with provider: {provider.value}')
            return result, attempted
        except Exception as e:
            error_str = str(e).lower()
            is_rate_limit = any(
                term in error_str
                for term in ['429', 'rate limit', 'quota', 'resource_exhausted', 'too many']
            )
            if is_rate_limit:
                logger.warning(f'Rate limit on {provider.value}, trying next provider')
            else:
                logger.error(f'Error on {provider.value}: {e}')
            last_error = e
            continue

    raise Exception(f'All providers failed. Last error: {last_error}')