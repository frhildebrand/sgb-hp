const { DateTime } = require("luxon");

module.exports = function (config) {
  // Datums-Filter hinzufügen
  config.addFilter("dateFilter", (dateObj) => {
    if (!dateObj) return "";
    return DateTime.fromJSDate(dateObj).toFormat("dd.MM.yyyy");
  });

  // Create a collection of all news articles based on their file location
  config.addCollection("news", function(collectionApi) {
    return collectionApi.getFilteredByGlob("src/news/**/*.md");
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
        text: match[3].replace(/<[^>]+>/g, '').trim() // Strip inner HTML tags
      });
    }
    return headings;
  });

  config.addPassthroughCopy("src/assets");
  config.addPassthroughCopy("src/images");
  config.addPassthroughCopy("src/downloads");
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
