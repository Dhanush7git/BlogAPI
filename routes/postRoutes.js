const express = require('express');
const router = express.Router();
const postController = require('../Controllers/postController');
const verifyToken = require('../middleware/authMiddleware'); // Adjust path if needed

router.get('/', postController.getPosts);
router.get('/:id', postController.getPostById);
router.post('/', verifyToken, postController.createPost);
router.put('/:id', verifyToken, postController.updatePost);
router.delete('/:id', verifyToken, postController.deletePost);
router.post('/:id/comments', verifyToken, postController.addComment);
router.post('/:id/like', verifyToken, postController.likePost);

module.exports = router;