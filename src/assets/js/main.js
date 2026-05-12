/*
	Verti by HTML5 UP
	html5up.net | @ajlkn
	Free for personal and commercial use under the CCA 3.0 license (html5up.net/license)
*/

(function ($) {
  var $window = $(window),
    $body = $("body");

  // Breakpoints.
  breakpoints({
    xlarge: ["1281px", "1680px"],
    large: ["981px", "1280px"],
    medium: ["737px", "980px"],
    small: [null, "736px"],
  });

  // Play initial animations on page load.
  $window.on("load", function () {
    window.setTimeout(function () {
      $body.removeClass("is-preload");
    }, 100);
  });

  // Dropdowns.
  $("#nav > ul").dropotron({
    mode: "fade",
    noOpenerFade: true,
    speed: 300,
  });

  // Nav.

  // Toggle.
  $(
    '<div id="navToggle">' +
      '<a href="#navPanel" class="toggle"></a>' +
      "</div>",
  ).appendTo($body);

  // Panel.
  $('<div id="navPanel">' + "<nav>" + $("#nav").navList() + "</nav>" + "</div>")
    .appendTo($body)
    .panel({
      delay: 500,
      hideOnClick: true,
      hideOnSwipe: true,
      resetScroll: true,
      resetForms: true,
      side: "left",
      target: $body,
      visibleClass: "navPanel-visible",
    });

  // Carousel Navigation
  $(".carousel-nav").on("click", function () {
    const $carousel = $(this).siblings(".image-carousel");
    const scrollAmount = $carousel.find(".carousel-item").outerWidth() + 20; // Width + Gap

    $carousel.animate(
      {
        scrollLeft:
          $carousel.scrollLeft() +
          ($(this).hasClass("next") ? scrollAmount : -scrollAmount),
      },
      300,
    );
  });

  // Simple Lightbox for News Detail
  $(".news-detail .image.featured").on("click", function (e) {
    e.preventDefault();
    var src = $(this).attr("href");
    var $overlay = $('<div id="lightbox-overlay"></div>');
    var $img = $('<img src="' + src + '">');
    $overlay.hide().append($img).appendTo($body).fadeIn(300);

    $overlay.on("click", function () {
      $(this).fadeOut(300, function () {
        $(this).remove();
      });
    });
  });
})(jQuery);
