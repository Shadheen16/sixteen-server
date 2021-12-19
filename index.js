const express = require('express');
const cors = require('cors');
const admin = require("firebase-admin");
const fileUpload = require("express-fileupload");

const { MongoClient, MongoExpiredSessionError, ObjectId } = require('mongodb');


require('dotenv').config();


const app = express();
const port = process.env.PORT || 5000;


// geary-82a11-firebase-adminsdk
// var serviceAccount = require('./geary-82a11-firebase-adminsdk.json');
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount)
// });


// middleware
app.use(cors());
app.use(express.json());
app.use(fileUpload());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@mango.qwtht.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });


// verify token funtion
async function verifyToken(req, res, next) {
    if (req.headers?.authorization?.startsWith('Bearer ')) {
        const token = req.headers.authorization.split(' ')[1];

        try {
            const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodedUser.email;
        }
        catch {

        }

    }
    next();
}

const run = async () => {
    try {
        await client.connect();
        console.log("datebase connected successfully");

        const database = client.db("geary");
        const productCollection = database.collection("products");
        const orderCollection = database.collection("orders");
        const userCollection = database.collection("users");
        const feedbackCollection = database.collection("feedbacks");

        //get all products api

        app.get('/products', async (req, res) => {
            const cursor = productCollection.find({});
            const products = await cursor.toArray();
            res.send(products);
        });

        // GET Single product
        app.get('/products/:id', async (req, res) => {
            const id = req.params.id;
            console.log('getting specific product', id);
            const query = { _id: ObjectId(id) };
            const product = await productCollection.findOne(query);
            res.json(product);
        })

        //post api
        app.post('/products', async (req, res) => {
            console.log('api hitted')
            console.log(req.body);
            const title = req.body.title
            const price = req.body.price
            const description = req.body.description
            const quantity = req.body.quantity
            const img = req.files.image;
            const imgData = img.data;
            const encodedImg = imgData.toString('base64');
            const imgBuffer = Buffer.from(encodedImg, 'base64');
            const product = {
                title : title,
                price : price,
                description : description,
                quantity : quantity,
                image: imgBuffer
            };
            console.log(product);
            const result = await productCollection.insertOne(product);
            res.send(`A document was inserted with the _id: ${result.insertedId}`);
        });


        // update api
        app.put('/products/:id', async (req, res) => {
            const id = req.params.id;
            const updatedproduct = req.body;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updateproduct = {
                $set: {
                    title: updatedproduct.title,
                    description: updatedproduct.description,
                    price: updatedproduct.price,
                    image_url: updatedproduct.image_url
                },
            };
            const result = await productCollection.updateOne(filter, updateproduct, options)
            console.log('updating', id)
            res.json(result)
        })

        // DELETE product API
        app.delete('/products/:id', async (req, res) => {
            console.log("delete api hitted")
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await productCollection.deleteOne(query);
            res.json(result);
        });


        // Add Orders API
        app.post('/orders', async (req, res) => {
            console.log('posting order')
            const order = req.body;
            console.log(order);
            order.status = "pending";
            const result = await orderCollection.insertOne(order);
            res.json(result);
        });


      
        //get all orders api

        app.get('/orders', async (req, res) => {
            const cursor = orderCollection.find({});
            const orders = await cursor.toArray();
            res.send(orders);
        });

          // get orders by email
          app.post('/my-orders', async (req, res) => {
            console.log("getting single user orders")
            const userEmail = req.body.email;
            const cursor = orderCollection.find({ email: userEmail });
            const orders = await cursor.toArray();
            res.send(orders);
        })


        // Use POST to get  orders by keys
        app.post('/orders/byKeys', async (req, res) => {
            const keys = req.body;
            const query = { key: { $in: keys } }
            const orders = await orderCollection.find(query).toArray();
            res.send(orders);
        });


        // DELETE ORDER API
        app.delete('/orders/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await orderCollection.deleteOne(query);
            res.json(result);
        });

        // update order status API
        app.put('/orders/:id', async (req, res) => {
            const id = req.params.id;
            const updatedOrderStatus = req.body;
            console.log(updatedOrderStatus);
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updateStatus = {
                $set: {
                    status: updatedOrderStatus.status
                },
            };
            const result = await orderCollection.updateOne(filter, updateStatus, options)
            console.log('updating', id)
            res.json(result)
        })


        //users collection api
              app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            let isAdmin = false;
            if (user?.role === 'admin') {
                isAdmin = true;
            }
            res.json({ admin: isAdmin });
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await userCollection.insertOne(user);
            console.log(result);
            res.json(result);
        });

        app.put('/users', async (req, res) => {
            const user = req.body;
            const filter = { email: user.email };
            const options = { upsert: true };
            const updateDoc = { $set: user };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            res.json(result);
        });

        app.put('/users/admin',verifyToken, async (req, res) => {
            const user = req.body;
            const requester = req.decodedEmail;
            if (requester) {
                const requesterAccount = await userCollection.findOne({ email: requester });
                if (requesterAccount.role === 'admin') {
                    const filter = { email: user.email };
                    const updateDoc = { $set: { role: 'admin' } };
                    const result = await userCollection.updateOne(filter, updateDoc);
                    res.json(result);
                }
            }
            else {
                res.status(403).json({ message: 'you do not have access to make admin' })
            }

        })


        // post feedbacks
        app.post('/feedbacks', async (req, res) => {
            console.log('api hitted')
            console.log(req.body)
            const feedback = req.body;
            const result = await feedbackCollection.insertOne(feedback);
            res.send(`A document was inserted with the _id: ${result.insertedId}`);
        });

        // get feedbacks
        app.get('/feedbacks', async (req, res) => {
            const cursor = feedbackCollection.find({});
            const feedbacks = await cursor.toArray();
            res.send(feedbacks);
        })



    }
    finally {
        // client.close();
    }
};

run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('node server is running');
});

app.listen(port, () => {
    console.log('server running at port', port);
})

