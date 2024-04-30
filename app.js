const express = require('express');

const app = express();
const port = 3000;

const path = require('path');
const mongoose = require('mongoose');
const MongoClient = require('mongodb').MongoClient;
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const session = require('express-session');
const multer = require('multer');
const upload = multer();

const url = 'mongodb://127.0.0.1:27017/details';
const url2 = 'mongodb+srv://root:rahul@cluster0.01kig41.mongodb.net/details'; // Replace with your MongoDB connection URL
const secretKey = 'eyJhbGciOiJIUzI1NiJ9.eyJSb2xlIjoiQWRtaW4iLCJJc3N1ZXIiOiJJc3N1ZXIiLCJVc2VybmFtZSI6IkphdmFJblVzZSIsImV4cCI6MTY5ODMyMzAwNCwiaWF0IjoxNjk4MzIzMDA0fQ.oliXDweuyqg8qCkhqq6PUJkFE5lUKovEGQM0m137jmU'; // Replace with your own secret key

app.use(bodyParser.json());

app.use(express.static('public'));
app.use(express.json());

app.set('view engine', 'ejs');


app.use(bodyParser.urlencoded({extended: true}));

app.use(session({
    secret: secretKey,
    resave: false,
    saveUninitialized: true
}));


function isAuthenticated(req, res, next) {    
    const isLoggedIn = req.session.isLoggedIn || false;
    if (isLoggedIn) {
        next();
    } else {
        res.status(401).send('This feature is not accessible for Guests');
    }
}

function isShopkeeper(req, res, next) {
    const shopLoggedIn = req.session.shopLoggedIn;
    if(shopLoggedIn){
        next();
    }
    else{
        res.status(401).send("This Feature can only be accessed by Shopkeepers");
    }
}

mongoose.connect(url, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const db = mongoose.connection;    

db.on('connected',()=>{
    console.log('Connected to MongoDB Successfully');
})

db.on('error',(err)=>{
    console.error('Error Connecting to MongoDB');
})


app.get('/', (req,res)=>{
    res.sendFile(path.join(__dirname+'/public/homepage.html'));
})

app.get('/inventory', isAuthenticated, isShopkeeper, async (req, res) => {
    res.sendFile(path.join(__dirname + '/public/inventory.html'));
});

app.get('/new_user_register', (req,res)=>{
    res.sendFile(path.join(__dirname+'/public/new_user_registration.html'));
})

app.get('/new_shop_register', (req,res)=>{
    res.sendFile(path.join(__dirname + '/public/new_shop_register.html'));
})

// Consumer Data Schema
const ConsumerSchema = new mongoose.Schema({
    username: { type: String, required: true },
    password: { type: String, required: true },
    email: { type: String, required: true }
});

const Consumer = mongoose.model('consumer', ConsumerSchema);

const Shopkeeper = new mongoose.Schema({
    username: { type: String, required: true },
    password: { type: String, required: true },
    shop_name: { type: String, required: true },
    phone_number: { type: String, required: true }, // Added phone_number field
    shop_address: { type: String, required: true },
    latitude: { type: String, required: true }, // Added latitude field
    longitude: { type: String, required: true }, // Added longitude field
});

const Shop = mongoose.model('shop_register', Shopkeeper);

// Define a schema for inventory items
const inventoryItemSchema = new mongoose.Schema({
    item: { type: String, required: true},
    description: { type: String, required: true},
    price: { type: Number, required: true},
    quantity: { type: Number, required: true},
    shop_name: { type: String, required: true},
    phone_number: {type: String, required: true},
    shop_address: {type: String, required: true},
    latitude: { type: String, required: true},
    longitude: {type: String, required: true}
});

// Define a model for inventory items
const InventoryItem = mongoose.model('inventory', inventoryItemSchema);

// How to Check Login-Status in HTML, CSS, JS
app.get('/api/check-login-credentials', (req, res) => {
    
    // Check if the user is logged in and retrieve relevant data
    const isLoggedIn = req.session.isLoggedIn;
    const shopLoggedIn = req.session.shopLoggedIn;
    const shopName = req.session.shopName;
    const shopAddress = req.session.shopAddress;
    const phoneNumber = req.session.phoneNumber;
    const latitude = req.session.latitude;
    const longitude = req.session.longitude;
    // Return the login status as JSON
    res.json({ isLoggedIn, shopLoggedIn, shopName, shopAddress, phoneNumber, latitude, longitude });
});

// User Registration Route
app.post('/signup', async (req, res) => {
    const { username, password, email } = req.body;
  
    // Basic validation
    if (!username || !password || !email) {
      return res.status(400).send('All fields are required');
    }
  
    try {
      // Hash the user's password before storing it
      const saltRounds = 10; // You can adjust the number of salt rounds
      const hashedPassword = await bcrypt.hash(password, saltRounds);
  
      const newConsumer = new Consumer({
        username,
        password: hashedPassword,
        email
      });
  
      await newConsumer.save();
  
      res.status(201).send('Consumer Registration Successful');
    } catch (error) {
      console.error(error);
      res.status(500).send('Error while Registering');
    }
});

// User Login Route
app.post('/login', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    // Query the database to find the user
    db.collection('consumers').findOne({ username: username }, (err, user) => {
        if (err) {
            res.status(500).send('Error during login.');
        } else if (!user) {
            res.status(401).send('User not found.');
        } else if (!bcrypt.compareSync(password, user.password)) {
            res.status(401).send('Incorrect password.');
        } else {
            // Generate a JWT and send it as a response for user authentication
            const token = jwt.sign({ username: user.username }, secretKey, { expiresIn: '1h' });

            req.session = req.session || {};
            req.session.isLoggedIn = true;
            res.redirect('/');
        }
    });
});

// Shopkeeper Registration Route
app.post('/shop_signup', upload.none(), async (req, res) => {
    const { username, password, shop_name, phone_number, shop_address, latitude, longitude } = req.body;
    
    // Basic validation
    if (!password || !shop_name || !shop_address || !phone_number || !latitude || !longitude) {
        return res.status(400).send('All fields are required');
    }

    try {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const newShopkeeper = new Shop({
            username,
            password: hashedPassword,
            shop_name,
            phone_number,
            shop_address,
            latitude,
            longitude,
        });

        await newShopkeeper.save();

        res.status(201).send('Shopkeeper Registration Successful');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error while Registering');
    }
});

// Shopkeeper Login Route
app.post('/shop_login', async (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
      
    // Query the database to find the user
    db.collection('shop_registers').findOne({ username: username }, (err, user) => {
        if (err) {
            res.status(500).send('Error during login.');
        } else if (!user) {
            res.status(401).send('User not found.');
        } else if (!bcrypt.compareSync(password, user.password)) {
            res.status(401).send('Incorrect password.');
        } else {
            // Generate a JWT and send it as a response for user authentication
            const token = jwt.sign({ username: user.username }, secretKey, { expiresIn: '1h' });

            req.session = req.session || {};
            // Set session data to mark the user as logged in
            req.session.isLoggedIn = true;
            req.session.shopLoggedIn = true;
            req.session.shopAddress = user.shop_address;
            req.session.shopName = user.shop_name;
            req.session.phoneNumber = user.phone_number;
            req.session.latitude = user.latitude;
            req.session.longitude = user.longitude;

            // Send the token as a response or redirect as needed
            // For example, you can redirect to the home page
            res.redirect('/');
        }
    });
});

// User or Shopkeeper Logout Logic
app.post('/api/logout', (req, res) => {
    // Clear the session or perform any other logout actions
    req.session.destroy(err => {
        if (err) {
            console.error('Error during logout:', err);
            res.status(500).json({ error: 'Error during logout' });
        } else {
            // Send a JSON response indicating successful logout
            res.json({ success: true });
        }
    });
});

// Get Request API For Inventory
app.get('/api/inventory', async (req, res) => {
    try {
        const results = await db.collection('inventory')
        .aggregate([
            { $match: { shop_name: req.session.shopName } },
            {
                $addFields: {
                    priceAsNumber: { $toDouble: '$price' }
                }
            },
            { $sort: { item: 1, priceAsNumber: 1 } },
            { $project: { priceAsNumber: 0 } } // Exclude the temporary field from the output
        ])
        .toArray();

        res.json(results);
    } catch (err) {
        console.error('Error fetching sports:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Post Request API for Inventory
app.post('/api/items', async (req, res) => {
    const { item, description, quantity, price, shop_name, phone_number, shop_address, latitude, longitude } = req.body;
    if (!item || !description || !quantity || !price || !shop_name || !phone_number || !shop_address || !latitude || !longitude) {
        res.status(400).json({ error: 'Invalid request' });
        return;
    }
    try {
        const result = await db.collection('inventory').insertOne({
            item: item,
            description: description,
            quantity: quantity,
            price: price,
            shop_name: shop_name,
            phone_number: phone_number,
            shop_address: shop_address,
            latitude: latitude,
            longitude: longitude
        });

        res.json({ id: result.insertedId, item, description, quantity, price, shop_name, phone_number, shop_address, latitude, longitude });
    } catch (err) {
        console.error('Error adding item:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete Request API for Inventory
app.delete('/api/items/:itemName/:shop/:describe', async (req, res) => {
    const { itemName, shop, describe } = req.params;

    if (!itemName || !shop || !describe) {
        res.status(400).json({ error: 'Invalid request' });
        return;
    }
    try {
        const result = await db.collection('inventory').deleteOne({ item: itemName, shop_name: shop, description: describe });

        if (result.deletedCount === 0) {
            res.status(404).json({ error: 'Item not found' });
        } else {
            res.status(204).send();
        }
    } catch (error) {
        console.error('Error deleting item:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Put Request API for Inventory
app.put('/api/items/:itemName/:shop/:describe', async (req, res) => {
    const { itemName, shop, describe } = req.params;
    const { quantity, price } = req.body;

    if (!itemName || !quantity) {
        res.status(400).json({ error: 'Invalid request' });
        return;
    }

    try {
        const result = await db.collection('inventory').updateOne({ item: itemName, shop_name: shop, description: describe }, { $set: { quantity: quantity, price: price } });

        if (result.modifiedCount === 0) {
            res.status(404).json({ error: 'Item not found' });
        } else {
            res.status(204).send();
        }
    } catch (error) {
        console.error('Error updating item quantity:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// app.get for Search Results
app.get('/api/search', async (req, res) => {
    const searchTerm = req.query.searchTerm;
    const latitude = req.query.latitude;
    const longitude = req.query.longitude;

    try {
        const results = await db.collection('inventory').find({
            $or: [
                { item: { $regex: `.*${searchTerm}.*`, $options: 'i' } },
                { description: { $regex: `.*${searchTerm}.*`, $options: 'i' } }
            ]
        }).sort({ item: 1 }).toArray();
        
        results.sort((a, b) => {
            const containsSearchTermA = a.item.toLowerCase().includes(searchTerm.toLowerCase());
            const containsSearchTermB = b.item.toLowerCase().includes(searchTerm.toLowerCase());
        
            // If sport_name contains the search term, it comes first in the sorted order
            return containsSearchTermB - containsSearchTermA;
        });

        res.json(results);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Use app.post for rendering searchResults.ejs
app.post('/search', async (req, res) => {
    const searchTerm = req.body.searchTerm;
    const latitude = req.body.latitude;
    const longitude = req.body.longitude;
    try {
        const results = await db.collection('inventory').find({
            $or: [
                { item: { $regex: `.*${searchTerm}.*`, $options: 'i' } },
                { description: { $regex: `.*${searchTerm}.*`, $options: 'i' } }
            ]
        }).sort({ item: 1 }).toArray();

        results.sort((a, b) => {
            const containsSearchTermA = a.item.toLowerCase().includes(searchTerm.toLowerCase());
            const containsSearchTermB = b.item.toLowerCase().includes(searchTerm.toLowerCase());
        
            // If sport_name contains the search term, it comes first in the sorted order
            return containsSearchTermB - containsSearchTermA;
        });

        // Render the searchResults.ejs template with the results
        res.render('searchResults', { results, searchTerm, latitude, longitude });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal server error');
    }
});

app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});
