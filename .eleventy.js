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
