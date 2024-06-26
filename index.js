const express = require("express");
const cors = require("cors");
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { default: axios } = require("axios");

const corsOptions = {
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5000",
    "https://hotel-server-kappa.vercel.app",
    "https://hotel-spicy.netlify.app",
  ],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded());
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
    const paymentCollection = client.db("hotelSpicyDB").collection("payment");
    const usersCollection = client.db("hotelSpicyDB").collection("users");
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
    //users
    app.post('/singup',async(req,res) => {
      const getObj = req.body;
      const query = {email: getObj.email}
      const isExists = await usersCollection.findOne(query);
      if(!getObj.email || !getObj.photoURL){
        return res.status(400).send({message:'Please provide valid data'})
      }
      if(isExists){
        return res.status(400).send({message:'Email already exists'})
      }
      const data = await usersCollection.insertOne(getObj);
      if(data){
         res.status(200).send({message:'User created successfully'})
      }
    })
    app.get('/role/:email',async (req, res)=>{
      const getEmail =req.params.email;
      const query = {email: getEmail};
      const user = await usersCollection.findOne(query)
      res.send({
        role:user?.role
      })
    })
    app.get('/user/:email',async (req, res)=>{
      const getEmail =req.params.email;
      const query = {email: getEmail};
      const user = await usersCollection.findOne(query)
      res.send(user)
    })
    app.get("/allusers", async (req, res) => {
      const getSearch = req.query.search;
      const getEmail = req.query.email;
      let query = {};
      if (getSearch) {
        query = { name: getSearch };
      }
      if (getEmail) {
        query = { email: getEmail };
      }

      const allUsers = await usersCollection.find(query).toArray();
      res.send(allUsers);
    });
    app.patch("/allusers", async (req, res) => {
      const obj = req.body;
      const query = {
        email: obj.email,
      };
      const updateDoc = {
        $set: { role: obj.updateRole },
      };
      console.log(obj, "line65");
      const allUsers = await usersCollection.updateOne(query, updateDoc);
      res.send(allUsers);
    });
    //payment
    app.post('/create-payment',async(req,res)=>{
     const getObj = req.body;
     const transId = new ObjectId().toString();
     const initiatePayInfo={
      store_id:process.env.VITE_STORE_ID,
      store_passwd:process.env.VITE_STORE_PASS,
      total_amount:getObj.amount,
      currency:'BDT',
      tran_id:transId,
      success_url:'http://localhost:5000/success-payment',
      fail_url:'http://yoursite.com/fail.php&',
      cancel_url:'http://yoursite.com/cancel.php&',
      cus_name:getObj.customerName,
      cus_email:getObj.customerEmail,
      cus_add1:'Dhaka',
      cus_add2:'Dhaka',
      cus_city:'Dhaka',
      cus_state:'Dhaka',
      cus_postcode:1000,
      cus_country:'Bangladesh',
      cus_phone:'01711111111',
      cus_fax:'01711111111',
      shipping_method:"No",
      product_name:getObj.title,
      product_category:'Room',
      product_profile:'general',
      multi_card_name:'mastercard',
      value_a:'ref001_A',
      value_b:'ref002_B',
      value_c:'ref003_C',
      value_d:'ref004_D'
     }
     const response = await axios({
      method:"POST",
      url:"https://sandbox.sslcommerz.com/gwprocess/v4/api.php",
      data:initiatePayInfo,
      headers:{
       "Content-Type":'application/x-www-form-urlencoded'
      }
     }
     );
     const data = {
       roomName:getObj.title,
       fee:getObj.amount,
       status:'pending',
       transitionId:transId,
       Customer_Name:getObj.customerName,
       CustomerEmail:getObj.customerEmail,

     }
   const sendData = await paymentCollection.insertOne(data)
     if(sendData){
      res.send({paymentUrl:response.data.GatewayPageURL});
     }

    })
    app.post('/success-payment',async(req,res)=>{
       const successData = req.body;
       if(successData.status!== "VALID"){
        return res.status(400).send({ error: "Invalid status" });
       }
       const data = await paymentCollection.updateOne({transitionId:successData.tran_id},{$set:{status:"success"}});
       res.send(data);
       
    })

    app.get("/review", async (req, res) => {
      const getId = req.query.id;
      let query={}
      if(getId){
        query={BookingIdForReview:getId}
      }
      const cursor = reviewCollection.find(query).sort({ postDate: -1 });
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
      const result = await mybookingsCollection.insertOne(currentBooking);
      res.send(result);
    });
    //host get all rooms
    app.get("/allrooms", async (req, res) => {
      const getID = req.query.id;
      //console.log(typeof getID, getID);
      let query = {};
      if (getID === "0") {
        query = {
          status: "pending",
        };
      }
      if (getID === "1") {
        query = {
          status: "rejected",
        };
      }
      if (getID === "2") {
        query = {
          status: "approved",
        };
      }
      const Allrooms = await roomsCollection.find(query).toArray();
      res.send(Allrooms);
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
    
    app.patch("/updateDate/:id", async (req, res) => {
      const id = req.params.id;
      const updateDate = req.body;

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
