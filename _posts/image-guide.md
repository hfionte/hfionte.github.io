---
layout: post
title: "How to Include Images in Your Posts"
date: 2023-11-14 12:00:00 -0500
categories: tips
---

# Including Images in Your Jekyll Posts

You can include images in your Jekyll blog posts in several ways:

## Method 1: Using Markdown (Recommended)

```markdown
![Image Alt Text](/assets/images/sample-image.jpg)
```

This will render as:

![Image Alt Text](/assets/images/sample-image.jpg)

## Method 2: Using HTML for More Control

```html
<img src="/assets/images/sample-image.jpg" alt="Image Alt Text" width="500" height="300">
```

This gives you more control over dimensions:

<img src="/assets/images/sample-image.jpg" alt="Image Alt Text" width="500" height="300">

## Method 3: Using Relative Paths with baseurl

If your site uses a baseurl:

```markdown
![Image Alt Text]({{ site.baseurl }}/assets/images/sample-image.jpg)
```

## Method 4: For External Images

```markdown
![External Image](https://example.com/image.jpg)
```

## Best Practices

1. Store all images in the `/assets/images/` directory
2. Use descriptive filenames (e.g., `blog-post-header.jpg` not `img1.jpg`)
3. Optimize images for web before uploading
4. Always include alt text for accessibility

Happy blogging with images! 