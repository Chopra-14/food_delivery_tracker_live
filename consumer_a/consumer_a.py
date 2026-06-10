import json
import threading
import time
from flask import Flask, jsonify
from flask_cors import CORS
from kafka import KafkaConsumer

app = Flask(__name__)

CORS(
    app,
    resources={r"/*": {"origins": "*"}}
)
order_state={}

def consume_messages():
    consumer = KafkaConsumer(
        "order-events",
        bootstrap_servers="localhost:9092",
        group_id="status-tracker-group",
        auto_offset_reset="earliest",
        value_deserializer=lambda m: json.loads(m.decode("utf-8"))
    )

    print("Kafka Consumer Connected!")

    for message in consumer:
        event = message.value

        order_id = event["order_id"]

        order_state[order_id] = {
            "status": event["status"],
            "customer": event["customer"],
            "restaurant": event["restaurant"],
            "item": event["item"],
            "timestamp": event["timestamp"]
        }

        print(f"[RECEIVED] {order_id} -> {event['status']}")


def save_state():
    while True:
        with open("state.json", "w") as f:
            json.dump(order_state, f, indent=4)

        print("State saved to state.json")

        time.sleep(10)


from flask import jsonify, make_response

@app.route("/state", methods=["GET"])
def get_state():

    print("GET /state called")

    response = make_response(jsonify(order_state))

    response.headers["Access-Control-Allow-Origin"] = "*"

    return response
@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok"
    })
@app.route("/test")
def test():
    return jsonify({"message": "cors test"})

if __name__ == "__main__":

    consumer_thread = threading.Thread(
        target=consume_messages,
        daemon=True
    )

    save_thread = threading.Thread(
        target=save_state,
        daemon=True
    )

    consumer_thread.start()
    save_thread.start()

    app.run(
        host="0.0.0.0",
        port=5000
    )