import json
from kafka import KafkaConsumer

consumer = KafkaConsumer(
    "order-events",
    bootstrap_servers="localhost:9092",
    group_id="status-tracker-group",
    auto_offset_reset="earliest",
    value_deserializer=lambda m: json.loads(m.decode("utf-8"))
)

print("Consumer A started...")

for message in consumer:
    event = message.value

    print(
        f"[RECEIVED] {event['order_id']} -> {event['status']}"
    )