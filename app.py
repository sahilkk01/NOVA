import speech_recognition as sr
from services.ai_service import get_ai_response
from flask import Flask, render_template, request, jsonify, redirect, url_for
from database import create_table, save_conversation, get_conversations
from database import (
    create_table,
    save_conversation,
    get_conversations,
    connect_db
)
app = Flask(__name__)

# Create the database table when the app starts
create_table()


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/transcribe", methods=["POST"])
def transcribe():
    if "audio" not in request.files:
        return jsonify({"error": "No audio received"}), 400

    audio_file = request.files["audio"]
    recognizer = sr.Recognizer()

    try:
        with sr.AudioFile(audio_file) as source:
            audio = recognizer.record(source)

        text = recognizer.recognize_google(
            audio,
            language="en-IN"
        )

        return jsonify({"text": text})

    except sr.UnknownValueError:
        return jsonify({
            "error": "I could not understand your speech"
        }), 400

    except sr.RequestError:
        return jsonify({
            "error": "Speech service unavailable"
        }), 503


@app.route("/ask", methods=["POST"])
def ask():
    data = request.get_json(silent=True) or {}

    question = data.get("question", "").strip()

    if not question:
        return jsonify({
            "error": "Please enter a question."
        }), 400

    try:
        # Generate the AI response
        answer = get_ai_response(question)

        # Save the question and answer in SQLite
        save_conversation(question, answer)

        # Send the answer back to the frontend
        return jsonify({"answer": answer})

    except Exception:
        app.logger.exception("Error while processing the question")
        return jsonify({
            "error": "Sorry, NOVA could not process your question."
        }), 500



@app.route("/history")
def history():
    conversations = get_conversations()
    return render_template(
        "history.html",
        conversations=conversations
    )


@app.route("/delete_conversation/<int:conversation_id>", methods=["POST"])
def delete_conversation(conversation_id):
    connection = connect_db()
    cursor = connection.cursor()

    cursor.execute(
        "DELETE FROM conversations WHERE id = ?",
        (conversation_id,)
    )

    connection.commit()
    connection.close()

    return redirect(url_for("history"))


@app.route("/clear_history", methods=["POST"])
def clear_history():
    connection = connect_db()
    cursor = connection.cursor()

    cursor.execute("DELETE FROM conversations")

    connection.commit()
    connection.close()

    return redirect(url_for("history"))


if __name__ == "__main__":
    app.run(debug=True)
