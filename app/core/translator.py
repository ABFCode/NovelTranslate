import time
from dataclasses import dataclass
from typing import Optional

import openai

# Debug the import
try:
    from google import genai

    print(f"DEBUG: Successfully imported genai: {genai}")
    print(f"DEBUG: genai.Client: {genai.Client}")
except Exception as e:
    print(f"DEBUG: Import failed: {e}")
    raise

try:
    from google.genai import types

    print(f"DEBUG: Successfully imported types: {types}")
    print(f"DEBUG: types.GenerateContentConfig: {types.GenerateContentConfig}")
except Exception as e:
    print(f"DEBUG: Types import failed: {e}")
    raise


@dataclass
class TranslationResult:
    """Structured result from translation attempts."""

    success: bool
    text: Optional[str] = None
    error_message: Optional[str] = None
    model_used: Optional[str] = None
    tokens_used: Optional[int] = None


class Translator:
    """Core translation engine with fallback support."""

    def __init__(self):
        print("DEBUG: Translator.__init__ called")
        self.max_retries = 3
        self.retry_delay = 2  # seconds

    def translate(
        self, text: str, config: dict, openai_key: str = None, gemini_key: str = None
    ) -> TranslationResult:
        """
        Translate text using the provided configuration.

        Args:
            text: The text to translate
            config: Translation configuration dict
            openai_key: OpenAI API key
            gemini_key: Google Gemini API key

        Returns:
            TranslationResult with success status and translated text or error
        """
        print(f"DEBUG: translate() called with text length: {len(text) if text else 0}")

        if not text or not text.strip():
            return TranslationResult(success=False, error_message="Empty text provided")

        if not config:
            return TranslationResult(
                success=False, error_message="No configuration provided"
            )

        # Try primary model first
        primary_llm = config.get("primary_llm")
        primary_prompt = config.get("prompt", "")

        if primary_llm:
            print(f"DEBUG: Attempting translation with primary model: {primary_llm}")
            result = self._attempt_translation(
                text, primary_llm, primary_prompt, openai_key, gemini_key
            )
            if result.success:
                return result
            print(f"DEBUG: Primary model {primary_llm} failed: {result.error_message}")

        # Try fallback chain
        fallback_chain = config.get("fallback_chain", [])
        for i, fallback in enumerate(fallback_chain):
            fallback_llm = fallback.get("llm")
            fallback_prompt = fallback.get(
                "prompt", primary_prompt
            )  # Fall back to primary prompt if none specified

            if not fallback_llm:
                continue

            print(f"DEBUG: Attempting fallback #{i + 1}: {fallback_llm}")
            result = self._attempt_translation(
                text, fallback_llm, fallback_prompt, openai_key, gemini_key
            )
            if result.success:
                return result
            print(f"DEBUG: Fallback {fallback_llm} failed: {result.error_message}")

        return TranslationResult(
            success=False,
            error_message="All translation attempts failed. Check your API keys and model availability.",
        )

    def _attempt_translation(
        self, text: str, model: str, prompt: str, openai_key: str, gemini_key: str
    ) -> TranslationResult:
        """Attempt translation with a specific model."""
        print(f"DEBUG: _attempt_translation called with model: {model}")

        for attempt in range(self.max_retries):
            try:
                if model.startswith("gpt") or model.startswith("GPT"):
                    print(f"DEBUG: Using OpenAI for {model}")
                    return self._translate_openai(text, model, prompt, openai_key)
                elif model.startswith("gemini"):
                    print(f"DEBUG: Using Gemini for {model}")
                    return self._translate_gemini(text, model, prompt, gemini_key)
                else:
                    return TranslationResult(
                        success=False, error_message=f"Unsupported model: {model}"
                    )

            except Exception as e:
                print(
                    f"DEBUG: Translation attempt {attempt + 1} failed with {model}: {str(e)}"
                )
                import traceback

                traceback.print_exc()
                if attempt < self.max_retries - 1:
                    time.sleep(self.retry_delay * (attempt + 1))  # Exponential backoff

        return TranslationResult(
            success=False,
            error_message=f"Failed after {self.max_retries} attempts with {model}",
            model_used=model,
        )

    def _translate_openai(
        self, text: str, model: str, prompt: str, api_key: str
    ) -> TranslationResult:
        """Translate using OpenAI API."""
        print("DEBUG: _translate_openai called")
        if not api_key:
            return TranslationResult(
                success=False, error_message="OpenAI API key not provided"
            )

        try:
            client = openai.OpenAI(api_key=api_key)

            # Map model names to actual OpenAI model names
            openai_model = "gpt-4o-mini" if model.startswith("GPT-4") else model

            response = client.chat.completions.create(
                model=openai_model,
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": text},
                ],
                temperature=0.3,  # Slightly creative but consistent
                max_tokens=4000,  # Adjust based on model
            )

            translated_text = response.choices[0].message.content
            tokens_used = response.usage.total_tokens if response.usage else None

            return TranslationResult(
                success=True,
                text=translated_text,
                model_used=model,
                tokens_used=tokens_used,
            )

        except openai.AuthenticationError:
            return TranslationResult(
                success=False, error_message="Invalid OpenAI API key"
            )
        except openai.RateLimitError:
            return TranslationResult(
                success=False, error_message="OpenAI rate limit exceeded"
            )
        except openai.APIError as e:
            return TranslationResult(
                success=False, error_message=f"OpenAI API error: {str(e)}"
            )
        except Exception as e:
            return TranslationResult(
                success=False, error_message=f"OpenAI translation failed: {str(e)}"
            )

    def _translate_gemini(
        self, text: str, model: str, prompt: str, api_key: str
    ) -> TranslationResult:
        """Translate using Google Gemini API with the new Google Gen AI SDK."""
        print(f"DEBUG: _translate_gemini called with model: {model}")

        if not api_key:
            return TranslationResult(
                success=False, error_message="Gemini API key not provided"
            )

        try:
            print("DEBUG: About to create genai.Client")
            # Create client with the new SDK
            client = genai.Client(api_key=api_key)
            print(f"DEBUG: Successfully created client: {client}")

            # Map model names to actual Gemini model names

            gemini_model = "gemini-2.0-flash-001"

            print(f"DEBUG: Using model: {gemini_model}")
            print("DEBUG: About to call client.models.generate_content")

            # Use the correct API pattern from the official docs
            response = client.models.generate_content(
                model=gemini_model,
                contents=text,
                config=types.GenerateContentConfig(
                    system_instruction=prompt,
                    temperature=0.3,
                    max_output_tokens=4000,
                ),
            )

            print(f"DEBUG: Successfully got response: {response}")

            if not response.text:
                return TranslationResult(
                    success=False, error_message="Gemini returned empty response"
                )

            return TranslationResult(
                success=True,
                text=response.text,
                model_used=model,
                tokens_used=None,  # New SDK may provide usage metadata
            )

        except Exception as e:
            print(f"DEBUG: Exception in _translate_gemini: {e}")
            print(f"DEBUG: Exception type: {type(e)}")
            import traceback

            traceback.print_exc()

            error_msg = str(e).lower()
            if (
                "api key" in error_msg
                or "authentication" in error_msg
                or "401" in error_msg
            ):
                return TranslationResult(
                    success=False, error_message="Invalid Gemini API key"
                )
            elif "quota" in error_msg or "limit" in error_msg or "429" in error_msg:
                return TranslationResult(
                    success=False, error_message="Gemini quota/rate limit exceeded"
                )
            else:
                return TranslationResult(
                    success=False, error_message=f"Gemini translation failed: {str(e)}"
                )
