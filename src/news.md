---
layout: base.njk
heading: News
sidebarKey: training
---

### Aktuelle News

<div id="features-wrapper">
					<div class="container">
						<div class="row">
								<!-- Box -->
                {%- for post in collections.news -%}
                <div class="col-4 col-12-medium">
									<section class="box feature">
										<a href="{{ post.url }}" class="image featured"><img src="{{ post.data.image }}" alt="" /></a>
										<div class="inner">
											<header>
												<h2>{{ post.data.heading }}</h2>
												<small>{{ post.data.date }}</small>
											</header>
											<p>{{ post.data.excerpt }} <a href="{{ post.url }}" class="icon solid fa-arrow-circle-right">Mehr</a></p>
										</div>
									</section>
                  </div>
                  {% else %}
                    <p>Keine News gefunden.</p>
                  {%- endfor -%}							
						</div>
					</div>
				</div>
