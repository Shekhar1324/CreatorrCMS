const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const bcrypt = require("bcrypt");
const { title } = require("process");
const saltRounds = 5;
const flash = require("connect-flash");
var nodemailer = require('nodemailer');
const { url } = require("inspector");

require('dotenv').config();

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
app.set('view engine', 'ejs');

app.use(cookieParser());
app.use(flash());

// initialize express-session to allow us track the logged-in user across sessions.
app.use(
    session({
        key: "user_sid",
        secret:process.env.SECRET_KEY,
        resave: false,
        saveUninitialized: false,
        cookie: {
            expires: 600000,
        },
    })
);

// This middleware will check if user's cookie is still saved in browser and user is not set, then automatically log the user out.
// This usually happens when you stop your express server after login, your cookie still remains saved in the browser.
app.use((req, res, next) => {
    if (req.cookies.user_sid && !req.session.User) {
        res.clearCookie("user_sid");
    }
    next();
});

// middleware function to check for logged-in users
var sessionChecker = (req, res, next) => {
    if (req.session.User && req.cookies.user_sid) {
        res.redirect("/");
    } else {
        next();
    }
};

const storage = multer.diskStorage({
    destination: "public/images",
    filename: function (req, file, cb) {
        cb(
            null,
            file.fieldname + "_" + Date.now() + path.extname(file.originalname)
        );
    },
});
const upload = multer({ storage: storage }).single("myImage");

mongoose.connect(process.env.DB_URL);

const categorySchema = new mongoose.Schema({
    name: String,
    imageUrl: String
});

const Category = mongoose.model("Category", categorySchema);

const templateSchema = new mongoose.Schema({
    name: String,
    image: String
})
const Template = mongoose.model("Template", templateSchema);

const commentSchema = new mongoose.Schema({
    username: String,
    comment: String,
    imageComment: String
});
const Comment = mongoose.model("Comment", commentSchema);

const postSchema = new mongoose.Schema({
    title: String,
    content: String,
    comments: [commentSchema],
    imagePost: String,
    accountId: String,
    accountName: String,
    category: [String],
    templateId: String,
    viewsCount: { type: Number, default: 0 },
    reportCount: { type: Number, default: 0 }
});

const Post = mongoose.model("Post", postSchema);

const userSchema = new mongoose.Schema({
    firstName: String,
    lastName: String,
    address: String,
    phoneNumber: Number,
    occupation: String,
    email: String,
    password: String,
    imageProfile: String
});
const User = mongoose.model("User", userSchema);

app.get("/", async (req, res) => {
    try {
        var isSession = false;
        var user = {};
        if (req.session.User && req.cookies.user_sid) {
            isSession = true;
            user = await User.findById(req.session.user_id);
        }
        const page = Number(req.query.page) || 1;
        const limit = req.query.limit || 4;
        const posts = await Post.find().sort({ _id: -1 }).limit(limit * 1).skip((page - 1) * limit).exec();
        const count = await Post.find().countDocuments();
        const featuredPost=await Post.findOne().sort({viewsCount:-1}).limit(1);
        const categories = await Category.find();
        res.render("user/home", {
            posts: posts,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            categories: categories,
            featuredPost:featuredPost,
            isSession: isSession,
            user: user,
            messages: req.flash("home")
        });

    } catch (error) {
        console.log(error);
    }
});
app.get("/authUser/dashboard", function (req, res) {
    if (req.session.User && req.cookies.user_sid) {
        User.findById(req.session.user_id).then((user) => {
            res.render("authUser/dashboard", { user: user, messages: req.flash("profile") });
        })
    } else {
        res.redirect("/login");
    }
});

app.get("/authUser/posts", async (req, res) => {
    try {
        if (req.session.User && req.cookies.user_sid) {
            const page = Number(req.query.page) || 1;
            const limit = req.query.limit || 2;
            const posts = await Post.find({ accountId: req.session.user_id }).sort({ _id: -1 }).limit(limit * 1).skip((page - 1) * limit).exec();
            const count = await Post.find({ accountId: req.session.user_id }).countDocuments();
            const categories = await Category.find();
            const user = await User.findById(req.session.user_id);
            res.render("authUser/posts", {
                posts: posts,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                categories: categories,
                searchTerm: "",
                user: user,
                messages: req.flash("post")
            });
        } else {
            res.redirect("/login");
        }
    } catch (error) {
        console.log(error);
    }
});

app.post("/templateChoice", upload, async function (req, res) {

    await User.findOne({ _id: req.session.user_id }).then((user) => {
        const title = req.body.title;
        const content = req.body.content ? req.body.content : req.body.audioText;
        const imagePost = req.file.filename;
        const accountId = req.session.user_id;
        const accountName = user.firstName + " " + user.lastName;
        const category = req.body.selectedCategory;

        obj = {
            title: title,
            content: content,
            imagePost: imagePost,
            accountId: accountId,
            accountName: accountName,
            category: category
        };
    });

    await Template.find().then((found) => {
        if (found)
            res.render("authUser/template", { allTemplates: found, data: obj })
    });

});

app.get("/posts/:id", async (req, res) => {
    try {
        var isSession = false;
        var user = {};
        if (req.session.User && req.cookies.user_sid) {
            isSession = true;
            user = await User.findById(req.session.user_id);
        }
        console.log(req.params.id);
        const postclicked = await Post.findOne({ _id: req.params.id });
        let newCount = postclicked.viewsCount + 1;
        await Post.findOneAndUpdate({ _id: req.params.id }, { viewsCount: newCount }).then((foundPost) => { });
        const post = await Post.findOne({ _id: req.params.id })
        const postUser = await User.findById(post.accountId);

        const relatedPosts = await Post.find({ $and: [{ _id: { $ne: post._id } }, { category: { $in: post.category } }] }).sort({ _id: -1 }).limit(4)

        res.render("user/post", {
            title: post.title,
            content: post.content,
            id: post._id,
            name: post.accountName,
            image: post.imagePost,
            comments: post.comments,
            category: post.category,
            isSession: isSession,
            user: user,
            postUser, postUser,
            tempId: post.templateId,
            viewsCount: post.viewsCount,
            relatedPosts: relatedPosts
        });
    } catch (err) {
        console.log(err);
    }
});
app.get("/posts/edit/:id",  async (req, res) => {
    try {
        const categories = await Category.find();
        const post = await Post.findOne({ _id: req.params.id })
        const templates = await Template.find();
        res.render("authUser/edit_post", { post: post, categories: categories, allTemplates: templates });
    } catch (error) {
        console.log(error);
    }
});
app.get("/login", sessionChecker, function (req, res) {
    res.render("login", { messages: req.flash("login") });
});
app.get("/register", sessionChecker, function (req, res) {
    res.render("register", { messages: req.flash("register") });
});
app.get("/logout", (req, res) => {
    if (req.session.User && req.cookies.user_sid) {
        res.clearCookie("user_sid");
        res.redirect("/");
    } else {

        console.log("login first");
        res.redirect("/");
    }
});
app.get("/authUser/profile", function (req, res) {
    if (req.session.User && req.cookies.user_sid) {
        User.findById(req.session.user_id).then((user) => {
            res.render("authUser/profile", { user: user });
        });
    } else {
        res.redirect("/login");
    }
});
app.get("/contact", function (req, res) {
    var isSession = false;
    if (req.session.User && req.cookies.user_sid) {
        isSession = true;
    }
    res.render("contact", { isSession: isSession,messages: req.flash("contact") });
});
app.get("/about", function (req, res) {
    var isSession = false;
    if (req.session.User && req.cookies.user_sid) {
        isSession = true;
    }
    res.render("about", { isSession: isSession });
});
app.get("/categories", async (req, res) => {
    try {
        var isSession = false;
        var user = {};
        if (req.session.User && req.cookies.user_sid) {
            isSession = true;
            user = await User.findById(req.session.user_id);
        }
        const categories = await Category.find();

        res.render("category/category", {
            categories: categories,
            isSession: isSession,
            user: user
        });
    } catch (err) {
        console.log(err);
    }
});
app.get("/category/:name", async (req, res) => {
    try {
        var isSession = false;
        var user = {};
        if (req.session.User && req.cookies.user_sid) {
            isSession = true;
            user = await User.findById(req.session.user_id);
        }
        const page = Number(req.query.page) || 1;
        const limit = req.query.limit || 4;
        const name = req.params.name;
        const posts = await Post.find({ category: name }).sort({ _id: -1 }).limit(limit * 1).skip((page - 1) * limit).exec();
        const count = await Post.find({ category: name }).countDocuments();

        res.render("category/categories", {
            posts: posts,
            name: name,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            searchTerm: "",
            user: user,
            isSession: isSession
        });
    } catch (err) {
        console.log(err);
    }

});
app.get("/admin", async (req, res) => {
    if (req.session.User && req.cookies.user_sid) {
        const users = await User.find().sort({ _id: -1 });
        const posts = await Post.find().sort({ _id: -1 });
        const categories = await Category.find().sort({ _id: -1 });
        res.render("admin/admin", { users: users, posts: posts, categories: categories,messages: req.flash("admin") });
    } else {
        res.redirect("/login");
    }
})
app.get("/admin/users", async (req, res) => {
    if (req.session.User && req.cookies.user_sid) {
        const users = await User.find().sort({ _id: -1 });
        const posts = await Post.find().sort({ _id: -1 });

        res.render("admin/adminUser", { users: users,messages: req.flash("adminuser") });
    } else {
        res.redirect("/login");
    }
})
app.get("/admin/posts", async (req, res) => {
    if (req.session.User && req.cookies.user_sid) {
        const users = await User.find().sort({ _id: -1 });
        const posts = await Post.find().sort({ _id: -1 });

        res.render("admin/adminPost", { posts: posts, messages: req.flash("adminpost") });
    } else {
        res.redirect("/login");
    }
})
app.get("/admin/categories", async (req, res) => {
    if (req.session.User && req.cookies.user_sid) {
        const categories = await Category.find();

        res.render("admin/adminCategories", { categories: categories,messages: req.flash("admincategory") });
    } else {
        res.redirect("/login");
    }
})

app.get("/admin/categories/:id", async (req, res) => {
    if (req.session.User && req.cookies.user_sid) {
        const category = await Category.findById(req.params.id);

        res.render("admin/updateCategory", { category: category });
    } else {
        res.redirect("/login");
    }
})

app.get("/admin/reportedPosts", async (req, res) => {
    try {
        if (req.session.User && req.cookies.user_sid) {
            const posts = await Post.find({ reportCount: { $gt: 0 } }).sort({ reportCount: -1 });

            res.render("admin/adminReport", { posts: posts,messages: req.flash("adminreported") });
        } else {
            res.redirect("/login");
        }
    } catch (err) {
        console.log(err);
    }
})


app.post("/authUser/posts", upload, async function (req, res) {
    try {
        const user = await User.findOne({ _id: req.session.user_id });
        if (req.file) {
            const post = new Post({
                viewsCount: 0,
                title: req.body.title,
                content: req.body.content ? req.body.content : req.body.audioText,
                imagePost: req.file.filename,
                accountId: req.session.user_id,
                accountName: user.firstName + " " + user.lastName,
                category: req.body.selectedCategory
            });
            let newpost = JSON.stringify(post);
            const templates = await Template.find();

            res.render("authUser/template", { newpost, allTemplates: templates });
        }
    } catch (err) {
        console.log(err);
    }
});
app.post("/previewTemplate", function (req, res) {

    let temp = JSON.parse(req.body.data);
    let tempId = req.body.tempId;
    const post = new Post({
        viewsCount: 0,
        title: temp.title,
        content: temp.content,
        imagePost: temp.imagePost,
        accountId: temp.accountId,
        accountName: temp.accountName,
        category: temp.category,
        templateId: tempId
    });
    console.log(post.templateId);
    post.save();
    req.flash("home","Posted Successfully")
    res.redirect("/");
});

app.post("/posts/:id/comment", function (req, res) {
    const comment = new Comment({
        username: req.body.username,
        comment: req.body.comment,
        imageComment: req.body.url
    });

    Post.findOne({ _id: req.params.id }).then((foundPost) => {
        foundPost.comments.push(comment);
        foundPost.save();
        res.redirect("/posts/" + req.params.id);
    });
});

app.post("/upload", upload, (req, res) => {
    if (req.file) {
        Post.findByIdAndUpdate(req.body.postId,
            {
                title: req.body.title,
                content: req.body.content ? req.body.content : req.body.audioText,
                imagePost: req.file.filename,
                category: req.body.selectedCategory,
                templateId: req.body.tempId
            }
        ).then(() => {
            console.log("Success");
        });
        req.flash("post", "Post Updated Successfully!")
        res.redirect("/authUser/posts");
    } else {
        Post.findByIdAndUpdate(req.body.postId,
            {
                title: req.body.title,
                content: req.body.content ? req.body.content : req.body.audioText,
                category: req.body.selectedCategory,
                templateId: req.body.tempId
            }
        ).then(() => {
            console.log("Success");
        });
        req.flash("post", "Post Updated Successfully!")
        res.redirect("/authUser/posts");
    }
});
app.post("/delete", function (req, res) {
    const deletepostid = req.body.postId;
    Post.findByIdAndRemove(deletepostid).then(() => {
        console.log("Success");
        req.flash("post", "Post Deleted Successfully!")
        res.redirect("/authUser/posts");
    }).catch((err) => {
        console.log(err);
    });
});
app.post("/deleteAccount", async (req, res) => {
    try {
        const deletepostid = req.body.userId;
        await User.findByIdAndRemove(deletepostid);
        await Post.deleteMany({ accountId: deletepostid });
        res.redirect("/logout");
    } catch (err) {
        console.log(err);
    };
});

app.post("/register", async function (req, res) {

    const firstname = req.body.inputFirstName;
    const lastname = req.body.inputLastName;
    const address = req.body.inputAddress;
    const phoneNumber = req.body.inputNumber;
    const occupation = req.body.inputOccupation;
    const email = req.body.inputEmail;
    await User.findOne({ email: email }).then((match) => {
        if (match) {
            console.log("This email is already registered!!!");
            req.flash("login","User already exists, Login please!")
            res.redirect("/login");
        } else {
            bcrypt.hash(req.body.inputPassword, saltRounds).then((hash) => {
                var usernew = [{
                    firstName: firstname,
                    lastName: lastname,
                    address: address,
                    phoneNumber: phoneNumber,
                    occupation: occupation,
                    email: email,
                    password: hash


                }];

                const otp = Math.floor((Math.random() + 1) * 1000);

                let config = {
                    service: 'gmail',
                    auth: {
                        user: process.env.SMPT_MAIL,
                        pass: process.env.SMPT_PASSWORD
                    },
                };

                let transporter = nodemailer.createTransport(config);

                let message = {
                    from: process.env.SMPT_MAIL, // sender address
                    to: email, // list of receivers
                    subject: "Please Verify Your Email ", // Subject line
                    html: 'You OTP for  Creatorr Verification is ' + otp// html body
                };
                transporter.sendMail(message).then(() => {
                    console.log("mail sent");
                });
                console.log(usernew);
                res.render("registerOTP", { otp: otp, usernew: usernew });
            });
        }
    });
});

app.post("/registerOTP", function (req, res) {
    sentOTP = req.body.sentOTP;
    enteredOTP = req.body.inputOTP;
    if (sentOTP === enteredOTP) {

        var usernew = new User({
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            email: req.body.email,
            password: req.body.password,
            phoneNumber: req.body.phoneNumber,
            address: req.body.address,
            occupation: req.body.occupation
        });

        usernew.save().then((val) => {
            if (!val) res.redirect("/register");
            else {
                req.session.user_id = val._id;
                req.session.User = val;
                req.flash("profile","Your account is registered!")
                res.redirect("/authUser/dashboard");
            }
        });
    }
    else {
        console.log("wrong OTP");
        req.flash("register","Wrong OTP, Try again!")
        res.redirect("/register");
    }
});

app.post("/login", async (req, res) => {
    const email = req.body.inputEmail;
    const password = req.body.inputPassword;

    var foundUser = await User.findOne({ email: email }).exec();
    if (foundUser) {
        bcrypt.compare(password, foundUser.password).then((match) => {
            if (match) {
                req.session.User = foundUser;
                req.session.user_id = foundUser._id;
                
                if (email == "admin@admin.com") {
                    req.flash("admin","Admin Logged In")
                    res.redirect("/admin");
                } else {
                    req.flash("profile", "Logged in successfully!");
                    res.redirect("/authUser/dashboard");
                }
            }
            else {
                req.flash("login", "Wrong Password! Try Again");
                res.redirect("/login");
            }
        });
    }

    else {
        req.flash("login", "Sorry! User doesn't exist! Try SignUp");
        res.redirect("/login");
    }

});
app.post("/profile", upload, (req, res) => {
    if (req.file) {
        User.findByIdAndUpdate(req.session.user_id,
            {
                firstName: req.body.inputFirstName,
                lastName: req.body.inputLastName,
                address: req.body.inputAddress,
                phoneNumber: req.body.inputNumber,
                occupation: req.body.inputOccupation,
                imageProfile: req.file.filename
            }
        ).then(() => {
            console.log("Success");
        });
        req.flash("profile","Profile updated successfully!");
        res.redirect("/authUser/dashboard");
    } else {
        User.findByIdAndUpdate(req.session.user_id,
            {
                firstName: req.body.inputFirstName,
                lastName: req.body.inputLastName,
                address: req.body.inputAddress,
                phoneNumber: req.body.inputNumber,
                occupation: req.body.inputOccupation
            }
        ).then(() => {
            console.log("Success");
        });
        req.flash("profile", "Profile Updated Successfully")
        res.redirect("/authUser/dashboard");
    }
});

app.post("/contact", function (req, res) {

    if (req.session.User && req.cookies.user_sid) {

        var senderName = req.body.senderName;
        var senderEmail = req.body.senderEmail;
        var senderSubject = req.body.senderSubject;
        const senderText = req.body.senderText;
        const senderPassword = req.body.senderPassword;

        let config = {
            service: 'gmail',
            auth: {
                user: senderEmail,
                pass: senderPassword,
            },
        };

        let transporter = nodemailer.createTransport(config);


        let message = {
            from: senderEmail, // sender address
            to: "contactcreatorr99451@gmail.com", // list of receivers
            subject: "checking ", // Subject line
            html: senderText, // html body
        };
        transporter.sendMail(message).then(() => {
            req.flash("contact", "Mail Sent!");
            console.log("mail sent");
        });

        res.redirect("/contact");
    }
    else {
        console.log("Please login first");
        req.flash("login", "Please login first!")
        res.redirect("/contact");
    }

});

app.get('/search', async (req, res) => {
    try {
        var isSession = false;
        var user = {};
        if (req.session.User && req.cookies.user_sid) {
            isSession = true;
            user = await User.findById(req.session.user_id);
        }
        const page = Number(req.query.page) || 1;
        const limit = req.query.limit || 8;
        const posts = await Post.find({ $or: [{ title: { '$regex': ".*" + req.query.searchTerm + ".*", '$options': 'i' } }, { content: { '$regex': ".*" + req.query.searchTerm + ".*", '$options': 'i' } }, { accountName: { '$regex': ".*" + req.query.searchTerm + ".*", '$options': 'i' } }, { category: { '$regex': ".*" + req.query.searchTerm + ".*", '$options': 'i' } }] }).sort({ _id: -1 }).limit(limit * 1).skip((page - 1) * limit).exec();
        const count = await Post.find({ $or: [{ title: { '$regex': ".*" + req.query.searchTerm + ".*", '$options': 'i' } }, { content: { '$regex': ".*" + req.query.searchTerm + ".*", '$options': 'i' } }, { accountName: { '$regex': ".*" + req.query.searchTerm + ".*", '$options': 'i' } }, { category: { '$regex': ".*" + req.query.searchTerm + ".*", '$options': 'i' } }] }).countDocuments();
        console.log(count);
        res.render("user/search", {
            posts: posts,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            searchTerm: req.query.searchTerm,
            isSession: isSession,
            user: user
        });
    } catch (error) {
        console.log(error);
    }
});

app.get('/searchPost', async (req, res) => {
    try {
        const user = await User.findById(req.session.user_id);
        const page = Number(req.query.page) || 1;
        const limit = req.query.limit || 2;
        const posts = await Post.find({ accountId: req.session.user_id, $or: [{ title: { '$regex': ".*" + req.query.searchTerm + ".*", '$options': 'i' } }, { content: { '$regex': ".*" + req.query.searchTerm + ".*", '$options': 'i' } }, { category: { '$regex': ".*" + req.query.searchTerm + ".*", '$options': 'i' } }] }).sort({ _id: -1 }).limit(limit * 1).skip((page - 1) * limit).exec();
        const count = await Post.find({ accountId: req.session.user_id, $or: [{ title: { '$regex': ".*" + req.query.searchTerm + ".*", '$options': 'i' } }, { content: { '$regex': ".*" + req.query.searchTerm + ".*", '$options': 'i' } }, { category: { '$regex': ".*" + req.query.searchTerm + ".*", '$options': 'i' } }] }).countDocuments();
        const categories = await Category.find();
        res.render("authUser/posts", {
            posts: posts,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            searchTerm: req.query.searchTerm,
            categories: categories,
            user: user,
            messages: req.flash("post")
        });
    } catch (error) {
        console.log(error);
    }
});

app.get('/category/:name/searchCategories', async (req, res) => {
    try {
        var isSession = false;
        var user = {};
        if (req.session.User && req.cookies.user_sid) {
            isSession = true;
            user = await User.findById(req.session.user_id);
        }
        const page = Number(req.query.page) || 1;
        const limit = req.query.limit || 8;
        const name = req.params.name;
        const posts = await Post.find({ category: name, $or: [{ title: { '$regex': ".*" + req.query.searchTerm + ".*", '$options': 'i' } }, { content: { '$regex': ".*" + req.query.searchTerm + ".*", '$options': 'i' } }, { accountName: { '$regex': ".*" + req.query.searchTerm + ".*", '$options': 'i' } }] }).sort({ _id: -1 }).limit(limit * 1).skip((page - 1) * limit).exec();
        const count = await Post.find({ category: name, $or: [{ title: { '$regex': ".*" + req.query.searchTerm + ".*", '$options': 'i' } }, { content: { '$regex': ".*" + req.query.searchTerm + ".*", '$options': 'i' } }, { accountName: { '$regex': ".*" + req.query.searchTerm + ".*", '$options': 'i' } }] }).countDocuments();

        res.render("category/categories", {
            posts: posts,
            name: name,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            searchTerm: req.query.searchTerm,
            user: user,
            isSession: isSession
        });
    } catch (error) {
        console.log(error);
    }
});

app.post("/adminDelete", function (req, res) {
    const deletepostid = req.body.postId;
    Post.findByIdAndRemove(deletepostid).then(() => {
        console.log("Success");
        req.flash("adminpost", "Post Deleted Successfully!")
        res.redirect("/admin/posts");
    }).catch((err) => {
        console.log(err);
    });
});
app.post("/admindeleteAccount", async (req, res) => {
    try {
        const deletepostid = req.body.userId;
        await User.findByIdAndRemove(deletepostid);
        await Post.deleteMany({ accountId: deletepostid });
        req.flash("adminuser", "User Deleted Successfully!")
        res.redirect("/admin/users");
    } catch (err) {
        console.log(err);
    };
});
app.post("/updateCat/:id/update", upload, (req, res) => {
    if (req.file) {
        Category.findByIdAndUpdate(req.params.id,
            {
                name: req.body.catName,
                imageUrl: req.file.filename
            }
        ).then(() => {
            console.log("Success");
        });
        req.flash("admincategory", "Category Updated Successfully!")
        res.redirect("/admin/categories");
    } else {
        Category.findByIdAndUpdate(req.params.id,
            {
                name: req.body.catName
            }
        ).then(() => {
            console.log("Success");
        });
        // req.flash("profile","Profile Updated Successfully")
        req.flash("admincategory", "Category Updated Successfully!")
        res.redirect("/admin/categories");
    }
});
app.post("/admin/addCategory", upload, (req, res) => {
    const category = new Category({
        name: req.body.name,
        imageUrl: req.file.filename
    });

    category.save();
    req.flash("admincategory", "Category Added Successfully!")
    res.redirect("/admin/categories");
});
app.post("/adminCatDelete", function (req, res) {
    Category.findByIdAndRemove(req.body.catId).then(() => {
        req.flash("admincategory", "Category Deleted Successfully!")
        res.redirect("/admin/categories");
    })
})
app.post("/posts/:id/report", async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        post.reportCount = post.reportCount + 1;
        post.save();

        res.redirect("/posts/" + req.params.id);
    } catch (err) {
        console.log(err);
    }
})
app.post("/reportDelete", function (req, res) {
    const deletepostid = req.body.postId;
    Post.findByIdAndRemove(deletepostid).then(() => {
        console.log("Success");
        req.flash("adminreported", "Successfully deleted the reported post!")
        res.redirect("/admin/reportedPosts");
    }).catch((err) => {
        console.log(err);
    });
});
app.post("/reportVerify", async (req, res) => {
    try {
        const postId = req.body.postId;
        const post = await Post.findById(postId);
        post.reportCount = 0;
        post.save();
        req.flash("adminreported", "Reported post is verified to be fine!")
        res.redirect("/admin/reportedPosts");
    } catch (err) {
        console.log(err);
    }
});

app.get("/resetPass", function (req, res) {
    res.render("OtpPass");
});

app.post("/emailVerify", function (req, res) {
    userInputEmail = req.body.inputEmail;

    const otp = Math.floor((Math.random() + 1) * 1000);

    let config = {
        service: 'gmail',
        auth: {
            user: process.env.SMPT_MAIL,
            pass: process.env.SMPT_PASSWORD
        },
    };

    let transporter = nodemailer.createTransport(config);

    let message = {
        from: process.env.SMPT_MAIL, // sender address
        to: userInputEmail, // list of receivers
        subject: "Please Verify Your Email ", // Subject line
        html: 'You OTP for  Password Reset is ' + otp// html body
    };
    transporter.sendMail(message).then(() => {
        console.log("mail sent");
    });

    res.render("otpSubmit", { otp });
});

app.post("/otpCheck", function (req, res) {
    if (req.body.sentOTP === req.body.userOTP) {
        res.render("passwordReset");
    } else {
        console.log("You Entered wrong OTP");
        req.flash("login", "Wrong OTP! Try again.")
        res.redirect("/login");
    }
});

app.post("/passwordReset", async function (req, res) {

    if (req.body.inputPassword === req.body.confirminputPassword) {
        let hashedPass = await bcrypt.hash(req.body.inputPassword, saltRounds);
        await User.findOneAndUpdate({ email: req.body.inputEmail },
            { password: hashedPass }).then((found) => {
                if (found) {
                    console.log("Password Updated");
                    // req.flash("login","Password updated! Login now.")
                    res.redirect("/login");
                } else {
                    console.log("Some error occured");
                    req.flash("login","Some error occured!")
                    res.redirect("/login");
                }
            })
    } else {
        console.log("Password and confirm Password do not match");
        req.flash("login","Password and confirm Password did not match!")
        res.redirect("/login");
    }
});


app.listen(process.env.PORT, function () {
    console.log(`Connected ${process.env.PORT}`);
});