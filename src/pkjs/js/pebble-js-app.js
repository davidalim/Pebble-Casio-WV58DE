var initialised = false;
var CityID = 0, posLat = "0", posLon = "0", lang = "en";

var weatherIcon = {
    "01d" : 'I',	//clear sky (day)
    "02d" : '"',	//few clouds (day)
    "03d" : '!',	//scattered clouds
    "04d" : 'k',	//broken clouds
    "09d" : '$',	//shower rain
    "10d" : '+',	//rain (day)
    "11d" : 'F',	//thunderstorm
    "13d" : '9',	//snow
    "50d" : '=',	//mist (day)
    "01n" : 'N',	//clear sky (night)
    "02n" : '#',	//few clouds (night)
    "03n" : '!',	//scattered clouds
    "04n" : 'k',	//broken clouds
    "09n" : '$',	//shower rain
    "10n" : ',',	//rain (night)
    "11n" : 'F',	//thunderstorm
    "13n" : '9',	//snow
    "50n" : '>'		//mist (night)
};

//-----------------------------------------------------------------------------------------------------------------------
Pebble.addEventListener("ready", function() {
    initialised = true;
	var p_lang = "en_US";

	//Get pebble language
	if(Pebble.getActiveWatchInfo) {
		try {
			var watch = Pebble.getActiveWatchInfo();
			p_lang = watch.language;
		} catch(err) {
			console.log("Pebble.getActiveWatchInfo(); Error!");
		}
	} 

	//Choose language
	var sub = p_lang.substring(0, 2);
	if (sub === "de")
		lang = "de";
	else  if (sub === "es")
		lang = "es";
	else if (sub === "fr")
		lang = "fr";
	else if (sub === "it")
		lang = "it";
	else
		lang = "en";

	console.log("JavaScript app ready and running! Pebble lang: " + p_lang + ", using for Weather: " + lang);
	sendMessageToPebble({"JS_READY": 1});
});

//-----------------------------------------------------------------------------------------------------------------------
function sendMessageToPebble(payload) {
    Pebble.sendAppMessage(payload,
        function(e) {
            console.log('Successfully delivered message (' + e.payload + ') with transactionId='+ e.data.transactionId);
        },
        function(e) {
            console.log('Unable to deliver message with transactionId=' + e.data.transactionId + ' Error is: ' + e.error.message);
        });
}
//-----------------------------------------------------------------------------------------------------------------------
//-- Get current location: http://forums.getpebble.com/discussion/21755/pebble-js-location-to-url
var locationOptions = {
	enableHighAccuracy: true, 
	maximumAge: 10000, 
	timeout: 10000
};
//-----------------------------------------------------------------------------------------------------------------------
function locationSuccess(pos) {
	console.log('lat= ' + pos.coords.latitude + ' lon= ' + pos.coords.longitude);
	posLat = (pos.coords.latitude).toFixed(3);
	posLon = (pos.coords.longitude).toFixed(3);
	
	updateWeather();
}
//-----------------------------------------------------------------------------------------------------------------------
function locationError(err) {
	posLat = "0";
	posLon = "0";
	console.log('location error (' + err.code + '): ' + err.message);
}
//-----------------------------------------------------------------------------------------------------------------------
Pebble.addEventListener('appmessage', function(e) {
	console.log("Got message: " + JSON.stringify(e));
	if ('cityid' in e.payload) {	//Weather Download
		CityID = e.payload.cityid;
		if (CityID === 0)
			navigator.geolocation.getCurrentPosition(locationSuccess, locationError, locationOptions);
		else
			updateWeather();
	}
});

//-----------------------------------------------------------------------------------------------------------------------
// TODO: Get and store next few day's weather to display when offline
function updateWeather() {
	console.log("Updating weather");
	var URL = "http://api.openweathermap.org/data/2.5/weather?APPID=9a4eed6c813f6d55d0699c148f7b575a&";
	
	if (CityID !== 0)
		URL += "id="+CityID.toString();
	else if (posLat != "0" && posLon != "0")
		URL += "lat=" + posLat + "&lon=" + posLon;
	else
		return; //Error, no position data
	
	URL += "&units=metric&lang=" + lang + "&type=accurate";
	console.log("UpdateURL: " + URL);

    var req = new XMLHttpRequest();
    req.open("GET", URL, true);
    req.onload = function(e) {
        if (req.readyState == 4 && req.status == 200) {
            var response = JSON.parse(req.responseText);
            var temp = Math.round(response.main.temp);//-273.15
            var icon = response.weather[0].icon;
            var cond = response.weather[0].description;
            var name = response.name;
            console.log("Got Weather Data for City: " + name + ", Temp: " + temp + ", Icon:" + icon + "/" + weatherIcon[icon]+", Cond:"+cond);
            var weatherPayload = {
                "w_temp": temp,
                "w_icon": weatherIcon[icon],
                "w_cond": cond
            };
            // Chaining like this is ugly, but looks like the only option without pebble's support of promises
            updateSunsetTimes(weatherPayload);
        }
    };
    req.send(null);

}
//-----------------------------------------------------------------------------------------------------------------------
// TODO: Cache times and only update once a day
// TODO: Get and store next few day's times to display when offline
// TODO: Can't query using CityID. Need to force get pos if not available
function updateSunsetTimes(weatherPayload) {
    console.log("Updating sunrise/sunset times");
    var URL = "https://api.sunrise-sunset.org/json?";
    
    if (CityID !== 0)
        URL += "id="+CityID.toString();
    else if (posLat != "0" && posLon != "0")
        URL += "lat=" + posLat + "&lng=" + posLon;
    else
        return; //Error, no position data

    var date = new Date();
    var dateString = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();
    URL += "&date=" + dateString + "&formatted=0";
    console.log("UpdateURL: " + URL);

    var req = new XMLHttpRequest();
    req.open("GET", URL, true);
    req.onload = function(e) {
        if (req.readyState == 4 && req.status == 200) {
            var response = JSON.parse(req.responseText);
            var sunrise = Math.round(Date.parse(response.results.sunrise) / 1000); // convert to date
            var sunset = Math.round(Date.parse(response.results.sunset) / 1000); // convert to date
            var day_length = response.results.day_length; //
            console.log("Got sunset data for location: lat=" + posLat + ", lon: " + posLon + ", Sunrise Time:" + sunrise + ", Sunset Time:" + sunset + ", Day length:" + day_length);
            var sunsetPayload = {
                "sun_rise_time": sunrise.toString(), //convert to string to as we already handle those data format
                "sun_set_time": sunset.toString()
            };

            for (key in sunsetPayload){
                weatherPayload[key] = sunsetPayload[key];
            }
            sendMessageToPebble(weatherPayload);
        }
    };
    req.send(null);
}

//-----------------------------------------------------------------------------------------------------------------------
Pebble.addEventListener("showConfiguration", function() {
    var options = JSON.parse(localStorage.getItem('cas_wv_28de_opt'));
    console.log("read options: " + JSON.stringify(options));
    console.log("showing configuration");
	var uri = 'http://panicman.github.io/config_casiowv58de.html?title=Casio%20WV-58DE%20v2.10';
    if (options !== null) {
        uri +=
			'&inv=' + encodeURIComponent(options.inv) + 
			'&showsec=' + encodeURIComponent(options.showsec) + 
			'&battdgt=' + encodeURIComponent(options.battdgt) + 
			'&showbatt=' + encodeURIComponent(options.showbatt) + 
			'&vibr=' + encodeURIComponent(options.vibr) + 
			'&vibr_bt=' + encodeURIComponent(options.vibr_bt) + 
			'&datefmt=' + encodeURIComponent(options.datefmt) + 
			'&weather=' + encodeURIComponent(options.weather) + 
			'&showcond=' + encodeURIComponent(options.showcond) + 
			'&units=' + encodeURIComponent(options.units) + 
			'&cityid=' + encodeURIComponent(options.cityid);
    }
	console.log("Uri: "+uri);
    Pebble.openURL(uri);
});
//-----------------------------------------------------------------------------------------------------------------------
Pebble.addEventListener("webviewclosed", function(e) {
    console.log("configuration closed");
    if (e.response !== "") {
        var options = JSON.parse(decodeURIComponent(e.response));
        console.log("storing options: " + JSON.stringify(options));
        localStorage.setItem('cas_wv_28de_opt', JSON.stringify(options));
        sendMessageToPebble(options);
    } else {
        console.log("no options received");
    }
});
//-----------------------------------------------------------------------------------------------------------------------