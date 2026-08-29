const pool = require('../db/pool');
const redis = require('../db/redis');

// 1. Get paginated posts with Cache-Aside (60-second TTL)
exports.getPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const cacheKey = `posts:page:${page}:limit:${limit}`;

    // Check Redis cache first
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(JSON.parse(cachedData));
    }

    // Cache Miss - Query PostgreSQL
    const offset = (page - 1) * limit;
    const result = await pool.query(
      'SELECT * FROM posts ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    const responseData = { page, limit, posts: result.rows };

    // Save to Redis with 60-second TTL
    await redis.setex(cacheKey, 60, JSON.stringify(responseData));

    res.setHeader('X-Cache', 'MISS');
    res.json(responseData);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// 2. Get single post with comments + Cache-Aside (5-minute TTL)
exports.getPostById = async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `post:${id}`;

    // Check Redis cache first
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(JSON.parse(cachedData));
    }

    // Cache Miss - Query PostgreSQL
    const postResult = await pool.query('SELECT * FROM posts WHERE id = $1', [id]);
    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const commentsResult = await pool.query(
      'SELECT comments.*, users.username FROM comments JOIN users ON comments.author_id = users.id WHERE post_id = $1 ORDER BY created_at ASC',
      [id]
    );

    const responseData = {
      post: postResult.rows[0],
      comments: commentsResult.rows
    };

    // Save to Redis with 300-second (5 min) TTL
    await redis.setex(cacheKey, 300, JSON.stringify(responseData));

    res.setHeader('X-Cache', 'MISS');
    res.json(responseData);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// 3. Create a post (and invalidate post lists cache)
exports.createPost = async (req, res) => {
  try {
    const { title, content } = req.body;
    const author_id = req.user.id;

    const newPost = await pool.query(
      'INSERT INTO posts (title, content, author_id) VALUES ($1, $2, $3) RETURNING *',
      [title, content, author_id]
    );

    // Invalidate list caches so new post appears immediately
    const keys = await redis.keys('posts:page:*');
    if (keys.length > 0) {
      await redis.del(keys);
    }

    res.status(201).json({
      message: 'Post created successfully!',
      post: newPost.rows[0]
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// 4. Update a post (invalidate specific post cache & lists)
exports.updatePost = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;
    const userId = req.user.id;

    const postCheck = await pool.query('SELECT * FROM posts WHERE id = $1', [id]);
    if (postCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (postCheck.rows[0].author_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized. You can only edit your own posts.' });
    }

    const updatedPost = await pool.query(
      'UPDATE posts SET title = $1, content = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [title, content, id]
    );

    // Invalidate cache for this specific post and list caches
    await redis.del(`post:${id}`);
    const keys = await redis.keys('posts:page:*');
    if (keys.length > 0) await redis.del(keys);

    res.json({
      message: 'Post updated successfully!',
      post: updatedPost.rows[0]
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// 5. Add a comment (invalidate specific post cache so comments show up)
exports.addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const author_id = req.user.id;

    const newComment = await pool.query(
      'INSERT INTO comments (post_id, author_id, content) VALUES ($1, $2, $3) RETURNING *',
      [id, author_id, content]
    );

    // Invalidate post cache to reflect the new comment
    await redis.del(`post:${id}`);

    res.status(201).json({
      message: 'Comment added successfully!',
      comment: newComment.rows[0]
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// 6. Like a post (invalidate specific post cache)
exports.likePost = async (req, res) => {
  try {
    const { id } = req.params;
    const author_id = req.user.id;

    await pool.query(
      'INSERT INTO likes (post_id, author_id) VALUES ($1, $2)',
      [id, author_id]
    );

    await redis.del(`post:${id}`);

    res.status(201).json({ message: 'Post liked successfully!' });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'You have already liked this post.' });
    }
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// 7. Delete a post (invalidate specific post & list caches)
exports.deletePost = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const postCheck = await pool.query('SELECT * FROM posts WHERE id = $1', [id]);
    if (postCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (postCheck.rows[0].author_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized. You can only delete your own posts.' });
    }

    await pool.query('DELETE FROM posts WHERE id = $1', [id]);

    // Invalidate caches
    await redis.del(`post:${id}`);
    const keys = await redis.keys('posts:page:*');
    if (keys.length > 0) await redis.del(keys);

    res.json({ message: 'Post deleted successfully!' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};