async function loadOrders() {

    try {

        const response = await fetch(
            "http://localhost:5000/state"
        );

        const data = await response.json();

        console.log(data);

    }
    catch(error){

        console.error(
            "Failed to fetch orders:",
            error
        );

    }

}

// loadOrders();

// setInterval(
//     loadOrders,
//     5000
// );

const data = {
    "ORD0001": {
        customer: "Abhishek Singh",
        restaurant: "Biryani Corner",
        item: "Margherita Pizza",
        status: "DELIVERED"
    },
    "ORD0002": {
        customer: "Pallavi Nair",
        restaurant: "Cafe Aroma",
        item: "Hot Dog",
        status: "DELIVERED"
    }
};

const tableBody = document.getElementById("tableBody");

for (const orderId in data) {

    const order = data[orderId];

    const row = `
        <tr>
            <td>${orderId}</td>
            <td>${order.customer}</td>
            <td>${order.restaurant}</td>
            <td>${order.item}</td>
            <td>${order.status}</td>
        </tr>
    `;

    tableBody.innerHTML += row;
}