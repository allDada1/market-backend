const defaultProducts = [
{id:1,name:"Наушники",price:15000,category:"Техника",img:"https://via.placeholder.com/200"},
{id:2,name:"Мышка",price:8000,category:"Техника",img:"https://via.placeholder.com/200"},
{id:3,name:"Книга",price:5000,category:"Книги",img:"https://via.placeholder.com/200"}
];

let products = JSON.parse(localStorage.getItem("products"));
if(!products){
    localStorage.setItem("products",JSON.stringify(defaultProducts));
    products = defaultProducts;
}