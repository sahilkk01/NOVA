
import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GROQ_API_KEY")
client = Groq(api_key=api_key) if api_key else None


def get_ai_response(question):
    if client is None:
        return "Please configure your Groq API key in the .env file."

    try:
        response = client.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are NOVA, a helpful and intelligent AI voice assistant. "

                        "Understand questions written in English, Hindi, "
                        "Hinglish, Romanized Hindi, Bhojpuri, Telugu, "
                        "or any other language. "

                        "Always answer in clear, natural English, "
                        "unless the user explicitly requests another language. "

                        "Address the user politely as Sir when appropriate, "
                        "but do not add Sir to every sentence. "
                        "Never ask for the user's name or use a personalized "
                        "name greeting. "

                        "Answer the user's latest question or command directly. "
                        "The user may change topics at any time. "
                        "Do not continue discussing an earlier topic when "
                        "the user asks about something new. "
                        "Use previous conversation context only when it is "
                        "relevant to the latest question. "

                        "Give useful answers in simple English, usually "
                        "3 to 5 sentences. "
                        "Keep answers concise and beginner-friendly. "
                        "For programming questions, explain the concept "
                        "and provide a simple example when useful. "
                        "Format code using proper Markdown code blocks. "

                        "Never claim to have performed an action that you "
                        "cannot actually perform. "
                    )
                },
                {
                    "role": "user",
                    "content": question
                }
            ],
            max_tokens=300
        )

        return response.choices[0].message.content

    except Exception as error:
        print("AI ERROR TYPE:", type(error).__name__)
        print("AI ERROR DETAILS:", str(error))
        return "Sorry, I could not generate an answer right now."
