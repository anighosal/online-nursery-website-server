const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5001;

const url = "mongodb://localhost:27017";
const dbName = "onlineNursery";

// Middleware
app.use(
  cors({
    origin: ["http://localhost:5177"],
    credentials: true,
  })
);
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lhk2now.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function run() {
  try {
    await client.connect();

    const db = client.db("onlineNursery");
    const productCollection = db.collection("products");
    const categoryCollection = db.collection("categories");
    const orderCollection = db.collection("orders");

    app.get("/products", async (req, res) => {
      try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 8;

        if (page <= 0 || limit <= 0) {
          return res
            .status(400)
            .json({ message: "Page and limit must be positive integers." });
        }

        const skip = (page - 1) * limit;

        const filter = {};
        if (req.query.category) {
          filter.category = req.query.category;
        }

        if (req.query.search) {
          filter.name = { $regex: req.query.search, $options: "i" };
        }

        const sortField = req.query.sort || "name";
        const sortOrder = req.query.order === "desc" ? -1 : 1;

        const totalProducts = await productCollection.countDocuments(filter);

        const products = await productCollection
          .find(filter)
          .sort({ [sortField]: sortOrder })
          .skip(skip)
          .limit(limit)
          .toArray();

        const totalPages = Math.ceil(totalProducts / limit);

        res.json({
          products,
          currentPage: page,
          totalPages,
          totalProducts,
        });
      } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({ message: "Server Error" });
      }
    });

    app.get("/products/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const product = await productCollection.findOne({
          _id: new ObjectId(id),
        });
        if (!product) {
          return res.status(404).json({ error: "Product not found" });
        }
        res.json(product);
      } catch (error) {
        console.error("Error fetching product by ID:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.post("/products", async (req, res) => {
      try {
        const newProduct = req.body;
        const result = await productCollection.insertOne(newProduct);
        const insertedProduct = await productCollection.findOne({
          _id: result.insertedId,
        });
        res.status(201).json(insertedProduct);
      } catch (error) {
        console.error("Error adding product:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.get("/products/search", async (req, res) => {
      const { query } = req.query;

      if (!query || query.trim() === "") {
        return res.status(400).json({ message: "Search query is required" });
      }

      try {
        console.log("Search query:", query);

        const products = await Product.find({
          title: { $regex: query, $options: "i" },
        });

        const categories = await Category.find({
          name: { $regex: query, $options: "i" },
        });

        res.status(200).json({ products, categories });
      } catch (error) {
        console.error("Search error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
      }
    });

    app.put("/products/:id", async (req, res) => {
      const { id } = req.params;
      const updatedFields = req.body;

      console.log("Received request to update product:", id, updatedFields);

      if (!ObjectId.isValid(id)) {
        console.error("Invalid product ID:", id);
        return res.status(400).json({ error: "Invalid product ID" });
      }

      try {
        const objectId = new ObjectId(id);

        const result = await db
          .collection("products")
          .updateOne({ _id: objectId }, { $set: updatedFields });

        if (result.matchedCount === 0) {
          console.error("Product not found:", id);
          return res.status(404).json({ error: "Product not found" });
        }

        const updatedProduct = await db
          .collection("products")
          .findOne({ _id: objectId });

        console.log("Updated product:", updatedProduct);

        res.json(updatedProduct);
      } catch (error) {
        console.error("Error updating product:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.delete("/products/:id", async (req, res) => {
      try {
        const { id } = req.params;
        console.log(id);
        const deletedProduct = await productCollection.deleteOne({
          _id: new ObjectId(id),
        });
        console.log(deletedProduct);

        res.status(200).json({ message: "Product deleted successfully" });
      } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
      }
    });

    app.post("/orders", async (req, res) => {
      try {
        const { name, phone, address, cartItems, paymentMethod } = req.body;
        console.log(name, phone, address, cartItems, paymentMethod);

        if (
          !name ||
          !phone ||
          !address ||
          !paymentMethod ||
          !Array.isArray(cartItems) ||
          cartItems.length === 0
        ) {
          console.log("Invalid order data");
          return res.status(400).json({ message: "Invalid order data" });
        }

        const newOrder = {
          name,
          phone,
          address,
          cartItems,
          paymentMethod,
          status: "Pending",
          createdAt: new Date(),
        };

        const result = await orderCollection.insertOne(newOrder);
        const insertedOrder = await orderCollection.findOne({
          _id: result.insertedId,
        });

        res.status(201).json({
          message: "Order created successfully",
          order: result,
        });
      } catch (error) {
        console.error("Error creating order:", error);
        res.status(500).json({ message: "Server Error" });
      }
    });

    app.get("/categories", async (req, res) => {
      try {
        const cursor = categoryCollection.find({});
        const categories = await cursor.toArray();
        res.json(categories);
      } catch (error) {
        console.error("Error fetching categories:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.get("/categories/:name", async (req, res) => {
      try {
        const { name } = req.params;
        const category = await categoryCollection.findOne({ name });
        if (!category) {
          return res.status(404).json({ error: "Category not found" });
        }
        const products = await productCollection
          .find({ category: category.name })
          .toArray();
        category.products = products;
        res.json(category);
      } catch (error) {
        console.error("Error fetching category and its products:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    process.on("SIGINT", async () => {
      await client.close();
      console.log("MongoDB connection closed");
      process.exit(0);
    });

    console.log("Connected to MongoDB and server is running...");
  } catch (error) {
    console.error("Error connecting to MongoDB", error);
    process.exit(1);
  }
}

run().catch(console.error);

app.listen(port, () => {
  console.log(`Online nursery website listening on port ${port}`);
});
