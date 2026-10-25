import Toybox.Lang;
import Toybox.WatchUi;

(:glance)
module Text {
    const SEPARATOR = " · ";
    const STALE_MARK = " !";
    const DELAY = "+$1$";

    var loaded as Dictionary<ResourceId, String> = {};

    // Cached because loading resources on every redraw is expensive.
    function get(id as ResourceId) as String {
        var text = loaded[id];
        if (text == null) {
            text = WatchUi.loadResource(id) as String;
            loaded[id] = text;
        }
        return text;
    }
}
