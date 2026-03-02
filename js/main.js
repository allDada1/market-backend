const categories = [
"Аккаунты",
"Игры",
"Софт",
"Подписки",
"Другое"
];

const products = [
{
title:"Minecraft аккаунт",
price:2000,
img:"https://picsum.photos/200?1"
},
{
title:"Steam аккаунт",
price:3500,
img:"https://picsum.photos/200?2"
},
{
title:"VPN подписка",
price:1500,
img:"https://picsum.photos/200?3"
}
];

const catBox = document.getElementById("categories");
categories.forEach(cat=>{
const div = document.createElement("div");
div.className="category";
div.textContent=cat;
catBox.appendChild(div);
});

const grid = document.getElementById("products");
products.forEach(p=>{
const card = document.createElement("div");
card.className="card";
card.innerHTML=`
<img src="${p.img}">
<h3>${p.title}</h3>
<p>${p.price}₸</p>
<button onclick="addToCart()">В корзину</button>
`;
grid.appendChild(card);
});

let cart=0;
function addToCart(){
cart++;
document.getElementById("cartCount").textContent=cart;
}
