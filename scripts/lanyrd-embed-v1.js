(function() {
	if (window.lanyrdBadge) {
		// script included multiple times, exit
		return;
	}

	window.lanyrd_badge_els = [];
	window.lanyrdBadgeIframes = [];
	window.lanyrdBadge = {};
	window.lanyrdBadges = {
		init: init
	};

	var cdn_prefix = 'http://cdn.lanyrd.net/';
	var badge_endpoint = 'http://badges.lanyrd.net/badges/embed/';
	if (location.protocol == 'https:') {
		cdn_prefix = 'https://s3.amazonaws.com/static.lanyrd.net/';
		badge_endpoint = 'https://lanyrd.com/badges/embed/';
	}

	var classStarting = 'lanyrd-',
		head = document.getElementsByTagName('head')[0];

	function init() {
		var lanyrdLinks = getLanyrdLinks(),
			linkNum = 0,
			link,
			params,
			serveStyles = true,
			queryString = '';

		for (var i = lanyrdLinks.length; i--;) {
			link = lanyrdLinks[i];
			params = getParamsForLink( lanyrdLinks[i] );

			if (params) {
				serveStyles = serveStyles && !params.options.nostyles;
				lanyrd_badge_els[ linkNum ] = link;
				queryString += 'b=' + encodeURIComponent( encodeParams(params) ) + '&';
				linkNum++;
			}

		}

		if (serveStyles) { addStyle(); }
		addScript( queryString );
		handleExpandyIframes();
	}

	function addListener(elm, type, func) {
		if (elm.addEventListener) {
			elm.addEventListener(type, func, false);
		}
		else if (elm.attachEvent) {
			elm.attachEvent('on' + type, func);
		}
	}

	function handleExpandyIframes() {
		if (handleExpandyIframes._executed) { return; }
		handleExpandyIframes._executed = true;

		addListener(window, 'message', function(event) {
			// event.data should be in the format 'iframeIndex:height'
			var data = event.data.split(':'),
				iframe = lanyrdBadgeIframes[ data[0] ];

			if (iframe && event.origin.indexOf('lanyrd.') != -1) {
				iframe.style.height = data[1] + 'px';
			}
		});
	}

	function addStyle() {
		var link = document.createElement('link');
		link.href = cdn_prefix + 'badges/embed-v1.min.css';
		link.rel = 'stylesheet';
		head.appendChild(link);
	}

	function addScript(queryString) {
		var script = document.createElement('script');
		script.src = badge_endpoint + '?' + queryString;
		head.appendChild(script);
	}

	function encodeParams(params) {
		// This format feels a bit fragile, but a bit scared to change it
		var paramStr = params.slug + '.' + params.type,
			options = params.options;
		
		for (var key in options) {
			paramStr += '.' + key;

			// look out for non-boolean values
			if ( options[key] !== true ) {
				paramStr += '-' + options[key].replace("-", "%2D").replace(".", "%2E"); // encode . and - specially because of our silly serialization format
			}
		}

		return paramStr;
	}

	// Returns:
	// {
	//	type:
	//	slug:
	//	options: { 'attrName': val|true, ... }
	// }
	// Or false if link is invalid or unrecognised badge link
	var getParamsForLink = (function() {
		var urlRe = /^https?:\/\/lanyrd\.com\/(?:\w+)\/([^\/]+)\/?/i,
			eventUrlRe = /^https?:\/\/lanyrd\.com\/((?:\d{3,4})\/(?:[^\/]+))\//i,
			participantUrlRe = /^https?:\/\/(?:dev\.)?lanyrd\.(?:com|org)\/((?:\d{3,4})\/(?:[^\/]+))\/(speakers|attendees|trackers)\//i,
			sessionUrlRe = /^https?:\/\/(?:dev\.)?lanyrd\.(?:com|org)\/((?:\d{3,4})\/(?:[^\/]+))\/(s[a-z]+)/i;

		function addClassParams(link, badgeParams) {
			var classes = link.className.split(/\s+/),
				className,
				options = badgeParams.options,
				hyphenSplit;

			// Looping forward as the first matching class is unfortunately special
			for (var i = 0, len = classes.length; i < len; i++) {
				className = classes[i];

				// Is it a lanyrd- class?
				if ( className.indexOf(classStarting) === 0 ) {
					
					// The first class becomes the type - unfortunately legacy means we depend on the order
					if (!badgeParams.type) {
						badgeParams.type = className.slice( classStarting.length );
					}
					else {
						hyphenSplit = className.split('-');
						options[ hyphenSplit[1] ] = hyphenSplit[2] || true;
					}

				}

			}
		}

		function addDataParams(link, badgeParams) {
			var options = badgeParams.options,
				attributes = link.attributes,
				dataClassStarting = 'data-' + classStarting,
				attribute;
			
			for (var i = attributes.length; i--;) {
				attribute = attributes[i];

				if ( attribute.nodeName.indexOf(dataClassStarting) === 0 ) {
					options[ attribute.nodeName.slice( dataClassStarting.length ) ] = attribute.nodeValue || true;
				}
			}
		}

		return function(link) {
			var urlMatch,
				badgeParams = {
					options: {}
				};

			addClassParams(link, badgeParams);
			switch (badgeParams.type) {
				case "sessiontrackers":
					urlMatch = sessionUrlRe.exec(link.href);
					if (urlMatch) {
						badgeParams.options.sessionid = urlMatch[2];
					}
					break;
				case "schedule":
					urlMatch = eventUrlRe.exec(link.href);
					break;
				case "participants":
				case "speakers":
					urlMatch = participantUrlRe.exec(link.href);
					if (urlMatch) {
						badgeParams.options.usertype = urlMatch[2];
					}
					break;
				default:
					urlMatch = urlRe.exec(link.href);
					break;
			}

			if ( !urlMatch ) {
				// Invalid link url. Let the server deal with it.
				badgeParams.options.url = link.href;
				badgeParams.slug = "d";
			} else {
				badgeParams.slug = urlMatch[1];
			}
			addDataParams(link, badgeParams);

			return badgeParams;
		};
	})();

	function getLanyrdLinks() {
		var links,
			lanyrdLinks = [];

		if (document.querySelectorAll) {
			links = document.querySelectorAll('a[class*="' + classStarting + '"]');
		}
		else {
			links = document.getElementsByTagName('a');
		}

		// Get the lanyrd links
		// We do this with the QSA links too to avoid matching elms with class "blah-lanyrd-blah"
		for (var i = links.length; i--;) {
			if ( (' ' + links[i].className + ' ').indexOf(' ' + classStarting) != -1 && !links[i]._lanyrdEnhanced ) {
				links[i]._lanyrdEnhanced = 1;
				lanyrdLinks.push( links[i] );
			}
		}

		return lanyrdLinks;
	}

	var callbackIndex = 0;
	lanyrdBadge.jsonpCallbacks = {};

	function jsonp(url, callback) {
		var script = document.createElement('script'),
			cbProp = 'c' + callbackIndex;

		lanyrdBadge.jsonpCallbacks[ cbProp ] = function() {
			callback.apply(null, arguments);
			script.parentNode.removeChild( script );
			script = null;
			delete lanyrdBadge.jsonpCallbacks[ cbProp ];
		};

		script.src = url + 'lanyrdBadge.jsonpCallbacks.' + cbProp;
		document.body.insertBefore( script, document.body.firstChild );
		callbackIndex++;
	};
	
	function ieLoadPoll() {
		try {
			document.body.doScroll('up');
			return init();
		} catch(e) {}
		if (!executed) {
			setTimeout(ieLoadPoll, 30);
		}
	}

	if (document.addEventListener) {
		document.addEventListener('DOMContentLoaded', init, false);
		window.addEventListener('load', init, false);
	}
	else if (document.attachEvent) {
		document.createElement('abbr'); // So IE can style abbr
		ieLoadPoll();
	}

	// JS that acts on the output
	(function() {
		function expandAbstract(target) {
			target.innerHTML = "Loading...";
			jsonp( target.href + 'x-json/?callback=', function(data) {
				if (data.ok) {
					target.parentNode.parentNode.innerHTML = data['abstract'];
				}
				target = null;
			});
		}

		function expandBio(target) {
			target.innerHTML = "Loading...";
			jsonp( target.getAttribute('data-bio-url') + '?callback=', function(data) {
				if (data.ok) {
					target.parentNode.parentNode.innerHTML = data.bio;
				}
				target = null;
			});
		}

		addListener(document.body, 'click', function(event) {
			var target = event.target || event.srcElement,
				cancelEvent,
				action;

			if ( target.nodeName.toLowerCase() == 'a' ) {
				action = target.getAttribute('data-lanyrd-action');

				switch (action) {
					case "expand-abstract":
						expandAbstract(target);
						cancelEvent = true;
						break;
					case "expand-bio":
						expandBio(target);
						cancelEvent = true;
						break;
				}

				if ( cancelEvent ) {
					if ( event.preventDefault ) { event.preventDefault(); }
					return false;
				}
			}
		});
	})();
})();