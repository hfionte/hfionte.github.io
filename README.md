# Holly.dev Jekyll Blog

This is the source for the Jekyll site at [holly.dev](https://holly.dev).

## Adding Images to Posts

1. Place image files in the `assets/images/` directory
2. Reference them in your posts using:
   ```markdown
   ![Alt text](/assets/images/your-image-name.jpg)
   ```

## Local Development

1. Install dependencies: `bundle install`
2. Run the local server: `bundle exec jekyll serve`
3. View the site at: http://localhost:4000

## Creating New Posts

Add Markdown files to the `_posts/` directory with the naming convention:
```
YYYY-MM-DD-post-title.md
```

Make sure to include the front matter at the top:
```yaml
---
layout: post
title: "Your Post Title"
date: YYYY-MM-DD HH:MM:SS -0500
categories: category-name
---
``` 