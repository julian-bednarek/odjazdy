import Toybox.Activity;
import Toybox.Lang;
import Toybox.Position;
import Toybox.Weather;

// Glance and background can't use GPS, only positions the watch already has.
(:background :glance)
module Loc {
    const SOURCE_WEATHER = "W";
    const SOURCE_LAST_FIX = "A";

    function current() as [Double, Double, String]? {
        var weather = Toybox has :Weather ? Weather.getCurrentConditions() : null;
        var phone = weather != null ? weather.observationLocationPosition : null;
        if (phone != null) {
            return tagged(phone, SOURCE_WEATHER);
        }
        var activity = Activity.getActivityInfo();
        var lastFix = activity != null ? activity.currentLocation : null;
        return lastFix != null ? tagged(lastFix, SOURCE_LAST_FIX) : null;
    }

    function tagged(location as Position.Location, source as String) as [Double, Double, String] {
        var degrees = location.toDegrees();
        return [degrees[0], degrees[1], source];
    }
}
