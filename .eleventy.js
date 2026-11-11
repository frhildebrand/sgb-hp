const { DateTime } = require("luxon");

module.exports = function (config) {
  // Datums-Filter hinzufügen
  config.addFilter("dateFilter", (dateObj) => {
    if (!dateObj) return "";
    return DateTime.fromJSDate(dateObj).toFormat("dd.MM.yyyy");
  });

  // Create a collection of all news articles based on their file location
  config.addCollection("news", function (collectionApi) {
    return collectionApi.getFilteredByGlob("src/news/**/*.md");
  });

  config.addCollection("newsTags", (collectionApi) => {
    const posts = collectionApi.getFilteredByGlob("src/news/**/*.md");
    return [...new Set(posts.flatMap((post) => post.data.tags || []))].sort();
  });

  // Filter to extract headings with IDs for the sidebar TOC
  config.addFilter("extractHeadings", (content) => {
    if (!content) return [];
    const headings = [];
    // Matches h2 or h3 with an id attribute
    const regex = /<h([2-3])[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/gi;
    let match;
    while ((match = regex.exec(content)) !== null) {
      headings.push({
        level: match[1],
        id: match[2],
        text: match[3].replace(/<[^>]+>/g, "").trim(), // Strip inner HTML tags
      });
    }
    return headings;
  });

  config.addPassthroughCopy("src/assets/css/main.css");
  config.addPassthroughCopy("src/images");
  config.addPassthroughCopy("src/downloads");
  config.addPassthroughCopy({
    // Preserve the old image URL without maintaining a duplicate source file.
    "src/images/news/freibad.png": "images/personen/placeholder-action.png",
    "node_modules/@fortawesome/fontawesome-free/css/all.min.css":
      "assets/fontawesome/css/all.min.css",
    "node_modules/@fortawesome/fontawesome-free/webfonts":
      "assets/fontawesome/webfonts",
  });
  return {
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    dir: {
      input: "src",
      includes: "_includes",
      data: "_data",
      output: "_site",
    },
  };
};
