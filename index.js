const express = require('express');
const app = express();
const cors = require('cors');
// jwt
const jwt = require('jsonwebtoken');


require('dotenv').config()
const port = process.env.PORT || 5000;

// Payment option start
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
// Payment option end

// middleware
app.use(cors());
app.use(express.json());



const { MongoClient, ServerApiVersion, ObjectId, ObjectID } = require('mongodb');
const { default: Stripe } = require('stripe');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.qwzhyfr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const userCollection = client.db("bistroDB").collection("user");
    const menuCollection = client.db("bistroDB").collection("menu");
    const reviewCollection = client.db("bistroDB").collection("reviews");
    const cartsCollection = client.db("bistroDB").collection("carts");
    const paymentCollection = client.db("bistroDB").collection("payments");

    // jwt related api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '1h'
      });
      res.send({ token })
    })

    // middlewares 
    const verifyToken = (req, res, next) => {
      console.log('inside verified token:', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' });
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
      })

    }


    // verify Admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    }


    // user related api collection

    // finding all users
    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      console.log(req.headers);
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // admin checking 
    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin';

      }
      res.send({ admin });
    })

    app.post('/users', async (req, res) => {
      const user = req.body;
      // insert email id if doesn't exist
      // 
      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user already exist' });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    })

    // Patch or update user data
    app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    
    // delete user
    app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await userCollection.deleteOne(query);
      res.send(result);
    })


    //  menu related api
    app.get('/menu', async (req, res) => {
      try {
        const result = await menuCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error("Error in PATCH /menu :", error);
        res.status(500).send({ error: error.message });
      }
    })

    app.get('/menu/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: ObjectId(id) };
        const result = await menuCollection.findOne(query);
        res.send(result);
      } catch (error) {
        console.error("Error in PATCH /menu/:id:", error);
        res.status(500).send({ error: error.message });
      }

    })

    app.post('/menu', verifyToken, verifyAdmin, async (req, res) => {
      const item = req.body;
      const result = await menuCollection.insertOne(item);
      res.send(result);
    })

    // updating specific item using patch()
    app.patch('/menu/:id', async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: ObjectId(id) }
      const updateItem = {
        $set: {
          name: item.name,
          category: item.category,
          price: item.price,
          recipe: item.recipe,
          image: item.image
        }
      }

      const result = await menuCollection.updateOne(filter, updateItem);
      res.send(result);
    })


    // delete menu
    app.delete('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    });

    // admin user
    // app.get('/users/admin/:email', verifyToken, verifyAdmin, async (req, res) => {
    //   const email = req.params.email;
    //   if (email !== req.decoded.email) {
    //     return res.status(403).send({ message: 'forbidden access' });
    //   }

    //   const query = { email: email };
    //   const user = await userCollection.findOne(query);
    //   let admin = false;
    //   if (user) {
    //     admin = user?.role === 'admin';
    //   }
    //   res.send({ admin });
    // })

   


    app.get('/reviews', async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    })



    // Carts collection
    app.get('/carts', async (req, res) => {
      try {

        const email = req.query.email;
        const query = { email: email };
        const result = await cartsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error in PATCH /carts :", error);
        res.status(500).send({ error: error.message });
      }
    })

    

    // carts collection
    app.post('/carts', async (req, res) => {
      try {
        const cartItem = req.body;
        const result = await cartsCollection.insertOne(cartItem);
        res.send(result);
      } catch (error) {
        console.error("Error in PATCH /carts :", error);
        res.status(500).send({ error: error.message });
      }

    })

    

    // to delete a item
    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await cartsCollection.deleteOne(query);
      res.send(result);
    })


    // Payment option start
    app.post('/create-payment-intent', async (req, res) => {
      try {
        const { price } = req.body;
        if (!price || price <= 0) {
          // Return a 400 status for an invalid price, not 500
          return res.status(400).send({ error: "Invalid price" });
        }
        const amount = parseInt(price * 100);
        console.log(amount, 'amount inside the intent')

        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: 'usd',
          payment_method_types: ['card']
        });

        res.send({
          clientSecret: paymentIntent.client_secret
        })
      } catch (error) {
        console.error('Error in /create-payment-intent endpoint:', error);
        res.status(500).send({ error: error.message });
      }
    });

    // payment History
    app.get('/payments/:email', verifyToken, async (req, res) => {
      const query = { email: req.params.email }
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: "Forbidden Access" });
      }// verify if anyone try to fetch another person's history
      const result = await paymentCollection.find(query).toArray();
      res.send(result);

    }) // TODO: USE THIS API TO SHOW THE PAYMENT HISTORY

    app.post('/payments', async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);

      // console.log('Payment info saved on database:', payment);
      // delete carefully each item from the cart
      const query = {
        _id: {
          $in: payment.cartIds.map(id => ObjectId(id))
        }
      };

      const deleteResult = await cartsCollection.deleteMany(query);

      res.send({ paymentResult, deleteResult });

    })

    //----------------- Payment option end --------------------------


    // -------------- Admin Dashboard Status --------
    app.get('/admin-status', verifyToken, verifyAdmin, async (req, res) => {
      const users = await userCollection.estimatedDocumentCount(); // counting the total users 
      const menuItems = await menuCollection.estimatedDocumentCount();
      const orders = await paymentCollection.estimatedDocumentCount();

      const result = await paymentCollection.aggregate([
        {
          $group: {
            _id: null,
            totalRevenue: {
              $sum: '$price'
            }
          }
        }
      ]).toArray();

      const revenue = result.length > 0 ? result[0].totalRevenue : 0;

      res.send({
        users,
        menuItems,
        orders,
        revenue
      })
    })


    // aggregating database for showing multiple data info in a single api
    app.get('/order-stats', verifyToken, verifyAdmin, async (req, res) => {
      const result = await paymentCollection.aggregate([
        {
          $unwind: '$menuItemIds'
        },
        {
          $lookup: {
            from: 'menu',
            localField: 'menuItemIds',
            foreignField: '_id',
            as: 'menuItems'
          }
        },
        {
          $unwind: '$menuItems'
        },
        {
          $group: {
            _id: '$menuItems.category',
            quantity: { $sum: 1 },
            revenue: { $sum: '$menuItems.price' }
          }
        },
        {
          $project: {
            _id: 0,
            category: '$_id',
            quantity: '$quantity',
            revenue: '$revenue'
          }
        }
      ]).toArray();

      res.send(result)
    })

    // Admin dashboard end

    

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
  res.send('boss is sitting')
})

app.listen(port, () => {
  console.log(`Bistro boss is sitting on port ${port}`);
})


/**
 * --------------------------------------
 *      Naming Convention
 *  --------------------------------------
 * app.get('/users')
 * app.get('/users/:id')
 * app.post('/users')
 * app.put('/users/:id')
 * app.patch('/users/:id')
 * app.delete('/users/:id')
 * 
*/
