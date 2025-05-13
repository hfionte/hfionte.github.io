---
layout: post
title: "How to Add Authors to Your Posts"
date: 2023-11-15 12:00:00 -0500
categories: tips
author: Holly
---

# Adding Authors to Your Jekyll Posts

Each post on this blog can have an author specified. Here's how to manage post authorship:

## Adding an Author to a Post

In the front matter of your post, add the `author` field:

```yaml
---
layout: post
title: "Your Post Title"
date: 2023-11-15 12:00:00 -0500
categories: your-categories
author: Your Name
---
```

## Default Author

The default author for the blog is specified in `_config.yml`. If you don't add an author to a post, it won't display any author information.

## Author Display

The author name appears in the post header, just below the date.

## Multiple Authors

For posts with multiple authors, you can use a comma-separated list:

```yaml
author: Holly, Dan
```

## Author Pages

Currently, the blog doesn't have dedicated author pages. If we want to add them in the future, we'll need to create author collections or additional layouts.

Happy blogging! 