const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const corsOptions = {
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://hotel-server-kappa.vercel.app",
    "https://hotel-spicy.netlify.app",
  ],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2gfcy7h.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).send({ message: "unauthorized access" });
  if (token) {
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
      if (err) {
        console.log(err);
        return res.status(401).send({ message: "unauthorized access" });
      }
      console.log(decoded);

      req.user = decoded;
      next();
    });
  }
};

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    const reviewCollection = client.db("hotelSpicyDB").collection("review");
    const roomsCollection = client.db("hotelSpicyDB").collection("rooms");
    const feturesCollection = client.db("hotelSpicyDB").collection("fetures");
    const mybookingsCollection = client
      .db("hotelSpicyDB")
      .collection("mybooking");

    app.post("/jwt", async (req, res) => {
      const email = req.body;
      const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "365d",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });
    app.post("/logout", (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          maxAge: 0,
        })
        .send({ success: true });
    });

    app.get("/review", async (req, res) => {
      const cursor = reviewCollection.find().sort({ postDate: -1 });
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/fetures", async (req, res) => {
      const cursor = feturesCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });
    app.get("/roomsCount", async (req, res) => {
      const count = await roomsCollection.estimatedDocumentCount();
      res.send({ count });
    });
    app.get("/rooms", async (req, res) => {
      const low = parseInt(req.query.lprice);
      const high = parseInt(req.query.hprice);
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      const sortNum = parseInt(req.query.sort);
      let query = {};
      if (low && high) {
        query = { PricePerNight: { $gte: low, $lte: high } };
      }
      const result = await roomsCollection
        .find(query)
        .sort({ PricePerNight: sortNum })
        .skip(page * size)
        .limit(size)
        .toArray();
      res.send(result);
    });
    // app.get("/roomsfilter", async(req, res) => {
    // const low = parseInt(req.query.lprice);
    // const high = parseInt(req.query.hprice);
    //   // const low = req.query.lprice;
    //   // const high = req.query.hprice;
    //   console.log(low,high);
    //   const result = await roomsCollection.find().toArray()
    //   res.send(result);
    // });
    app.get("/rooms/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const singleRoom = await roomsCollection.findOne(filter);
      res.send(singleRoom);
    });
    app.get("/fetures", async (req, res) => {
      const cursor = feturesCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });
    app.post("/mybooking", async (req, res) => {
      const currentBooking = req.body;
      const BookID = currentBooking.bookingID;
      console.log(BookID);
      const result = await mybookingsCollection.insertOne(currentBooking);
      res.send(result);
    });
    //post review
    app.post("/myreview", async (req, res) => {
      const review = req.body;
      const result = await reviewCollection.insertOne(review);
      res.send(result);
    });

    //update roomavailablity true when delete
    app.patch("/updateTrue/:id", async (req, res) => {
      const id = req.params.id;
      const updateDoc = {
        $set: { Availability: true },
      };
      const availableQuery = { _id: new ObjectId(id) };
      const updateBidCount = await roomsCollection.updateOne(
        availableQuery,
        updateDoc
      );
    });
    //---->
    app.patch("/rooms/:id", async (req, res) => {
      const id = req.params.id;
      const updateAvailable = {
        $set: { Availability: false },
      };

      const availableQuery = { _id: new ObjectId(id) };
      const updateOne = await roomsCollection.updateOne(
        availableQuery,
        updateAvailable
      );
    });
    app.patch("/rooms/updateReview/:id", async (req, res) => {
      const id = req.params.id;
      const updateCountReview = req.body;
      const updateCount = {
        $set: { reviewCount: updateCountReview.updateReviewCount },
      };
      const availableQuery = { _id: new ObjectId(id) };
      const updateOne = await roomsCollection.updateOne(
        availableQuery,
        updateCount
      );
    });
    app.patch("/updateDate/:id", async (req, res) => {
      const id = req.params.id;
      const updateDate = req.body;
      console.log(updateDate.updatedDate);

      const updateDoc = {
        $set: { bookingDate: updateDate.updatedDate },
      };
      const availableQuery = { _id: new ObjectId(id) };
      const updateDateResult = await mybookingsCollection.updateOne(
        availableQuery,
        updateDoc
      );
      res.send(updateDateResult);
    });

    app.get("/mybooking", async (req, res) => {
      const userEmail = req.query.email;
      const queryRooms = { clientEmail: userEmail };
      const result = await mybookingsCollection.find(queryRooms).toArray();
      res.send(result);
    });

    app.delete("/mybooking/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await mybookingsCollection.deleteOne(query);

      res.send(result);
    });

    app.patch("/mybooking", async (req, res) => {
      const id = req.query.ReadID;
      const newDate = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: { date: newDate },
      };
      const result = await mybookingsCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("amazon is busy shopping");
});

app.listen(port, () => {
  console.log(`amazon server is running on port: ${port}`);
});
