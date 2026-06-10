import json
import threading
import time

from kafka import KafkaConsumer

analytics = {
    "PLACED": 0,
    "CONFIRMED": 0,
    "PREPARING": 0,
    "OUT_FOR_DELIVERY": 0,
    "DELIVERED": 0
}


def consume_messages():
    consumer = KafkaConsumer(
        "order-events",
        bootstrap_servers="localhost:9092",
        group_id="analytics-group",
        auto_offset_reset="earliest",
        value_deserializer=lambda m: json.loads(m.decode("utf-8"))
    )

    print("Analytics Consumer Started...")

    for message in consumer:
        event = message.value

        status = event["status"]

        analytics[status] += 1


def print_snapshot():
    while True:
        print("\n===== ANALYTICS =====")
        print(f"PLACED: {analytics['PLACED']}")
        print(f"CONFIRMED: {analytics['CONFIRMED']}")
        print(f"PREPARING: {analytics['PREPARING']}")
        print(f"OUT_FOR_DELIVERY: {analytics['OUT_FOR_DELIVERY']}")
        print(f"DELIVERED: {analytics['DELIVERED']}")
        print("=====================")

        time.sleep(15)


if __name__ == "__main__":

    consumer_thread = threading.Thread(
        target=consume_messages,
        daemon=True
    )

    analytics_thread = threading.Thread(
        target=print_snapshot,
        daemon=True
    )

    consumer_thread.start()
    analytics_thread.start()

    while True:
        time.sleep(1)