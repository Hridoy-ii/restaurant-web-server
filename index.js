const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');

require('dotenv').config();
const port = process.env.PORT || 5000;

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb'); // ✅ removed unused ObjectID
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.qwzhyfr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// ✅ FIX 1: Create client once, cache the connection promise for serverless
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

let clientPromise;

function getClientPromise() {
  if (!clientPromise) {
    clientPromise = client.connect();
  }
  return clientPromise;
}

// ✅ FIX 2: Helper to get DB collections (ensures connection before use)
async function getCollections() {
  await getClientPromise();
  const db = client.db("bistroDB");
  return {
    userCollection: db.collection("user"),
    menuCollection: db.collection("menu"),
    reviewCollection: db.collection("reviews"),
    cartsCollection: db.collection("carts"),
    paymentCollection: db.collection("payments"),
  };
}

// ----------- JWT Middleware -----------

const verifyToken = (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({ message: 'unauthorized access' });
  }
  const token = req.headers.authorization.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) return res.status(401).send({ message: 'unauthorized access' });
    req.decoded = decoded;
    next();
  });
};

const verifyAdmin = async (req, res, next) => {
  try {
    const { userCollection } = await getCollections();
    const email = req.decoded.email;
    const user = await userCollection.findOne({ email });
    if (user?.role !== 'admin') {
      return res.status(403).send({ message: 'forbidden access' });
    }
    next();
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

// ----------- JWT Route -----------

app.post('/jwt', (req, res) => {
  const user = req.body;
  const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
  res.send({ token });
});

// ----------- User Routes -----------

app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { userCollection } = await getCollections();
    const result = await userCollection.find().toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.get('/users/admin/:email', verifyToken, async (req, res) => {
  try {
    const { userCollection } = await getCollections();
    const email = req.params.email;
    if (email !== req.decoded.email) {
      return res.status(403).send({ message: 'forbidden access' });
    }
    const user = await userCollection.findOne({ email });
    res.send({ admin: user?.role === 'admin' });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.post('/users', async (req, res) => {
  try {
    const { userCollection } = await getCollections();
    const user = req.body;
    const existingUser = await userCollection.findOne({ email: user.email });
    if (existingUser) return res.send({ message: 'user already exist' });
    const result = await userCollection.insertOne(user);
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { userCollection } = await getCollections();
    const filter = { _id: new ObjectId(req.params.id) };
    const result = await userCollection.updateOne(filter, { $set: { role: 'admin' } });
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { userCollection } = await getCollections();
    const result = await userCollection.deleteOne({ _id: new ObjectId(req.params.id) });
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// ----------- Menu Routes -----------

app.get('/menu', async (req, res) => {
  try {
    const { menuCollection } = await getCollections();
    const result = await menuCollection.find().toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.get('/menu/:id', async (req, res) => {
  try {
    const { menuCollection } = await getCollections();
    const result = await menuCollection.findOne({ _id: new ObjectId(req.params.id) }); // ✅ fixed ObjectId
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.post('/menu', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { menuCollection } = await getCollections();
    const result = await menuCollection.insertOne(req.body);
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.patch('/menu/:id', async (req, res) => {
  try {
    const { menuCollection } = await getCollections();
    const item = req.body;
    const result = await menuCollection.updateOne(
      { _id: new ObjectId(req.params.id) }, // ✅ fixed ObjectId
      { $set: { name: item.name, category: item.category, price: item.price, recipe: item.recipe, image: item.image } }
    );
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.delete('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { menuCollection } = await getCollections();
    const result = await menuCollection.deleteOne({ _id: new ObjectId(req.params.id) }); // ✅ fixed ObjectId
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// ----------- Reviews -----------

app.get('/reviews', async (req, res) => {
  try {
    const { reviewCollection } = await getCollections();
    const result = await reviewCollection.find().toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// ----------- Cart Routes -----------

app.get('/carts', async (req, res) => {
  try {
    const { cartsCollection } = await getCollections();
    const result = await cartsCollection.find({ email: req.query.email }).toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.post('/carts', async (req, res) => {
  try {
    const { cartsCollection } = await getCollections();
    const result = await cartsCollection.insertOne(req.body);
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.delete('/carts/:id', async (req, res) => {
  try {
    const { cartsCollection } = await getCollections();
    const result = await cartsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// ----------- Payment Routes -----------

app.post('/create-payment-intent', async (req, res) => {
  try {
    const { price } = req.body;
    if (!price || price <= 0) return res.status(400).send({ error: 'Invalid price' });
    const paymentIntent = await stripe.paymentIntents.create({
      amount: parseInt(price * 100),
      currency: 'usd',
      payment_method_types: ['card']
    });
    res.send({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.get('/payments/:email', verifyToken, async (req, res) => {
  try {
    const { paymentCollection } = await getCollections();
    if (req.params.email !== req.decoded.email) {
      return res.status(403).send({ message: 'Forbidden Access' });
    }
    const result = await paymentCollection.find({ email: req.params.email }).toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.post('/payments', async (req, res) => {
  try {
    const { paymentCollection, cartsCollection } = await getCollections();
    const payment = req.body;
    const paymentResult = await paymentCollection.insertOne(payment);
    const deleteResult = await cartsCollection.deleteMany({
      _id: { $in: payment.cartIds.map(id => new ObjectId(id)) } // ✅ fixed ObjectId
    });
    res.send({ paymentResult, deleteResult });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// ----------- Admin Dashboard -----------

app.get('/admin-status', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { userCollection, menuCollection, paymentCollection } = await getCollections();
    const users = await userCollection.estimatedDocumentCount();
    const menuItems = await menuCollection.estimatedDocumentCount();
    const orders = await paymentCollection.estimatedDocumentCount();
    const result = await paymentCollection.aggregate([
      { $group: { _id: null, totalRevenue: { $sum: '$price' } } }
    ]).toArray();
    res.send({ users, menuItems, orders, revenue: result[0]?.totalRevenue || 0 });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.get('/order-stats', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { paymentCollection } = await getCollections();
    const result = await paymentCollection.aggregate([
      { $unwind: '$menuItemIds' },
      { $lookup: { from: 'menu', localField: 'menuItemIds', foreignField: '_id', as: 'menuItems' } },
      { $unwind: '$menuItems' },
      { $group: { _id: '$menuItems.category', quantity: { $sum: 1 }, revenue: { $sum: '$menuItems.price' } } },
      { $project: { _id: 0, category: '$_id', quantity: 1, revenue: 1 } }
    ]).toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// ----------- Root -----------

app.get('/', (req, res) => {
  res.send('boss is sitting');
});

app.listen(port, () => {
  console.log(`Bistro boss is running on port ${port}`);
});