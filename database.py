from datetime import datetime
import sqlite3

DATABASE_NAME = "nova.db"

def connect_db():
    return sqlite3.connect(DATABASE_NAME)


def create_table():
    connection = connect_db()
    cursor = connection.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question TEXT NOT NULL,
            answer TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)

    connection.commit()
    connection.close()


def save_conversation(question, answer):
    connection = connect_db()
    cursor = connection.cursor()

    cursor.execute("""
        INSERT INTO conversations (question, answer, created_at)
        VALUES (?, ?, ?)
    """, (question, answer, datetime.now().isoformat(timespec="seconds")))

    connection.commit()
    connection.close()


def get_conversations():
    connection = connect_db()
    cursor = connection.cursor()

    cursor.execute("""
        SELECT id, question, answer, created_at
        FROM conversations
        ORDER BY id DESC
    """)

    conversations = cursor.fetchall()
    connection.close()

    return conversations
