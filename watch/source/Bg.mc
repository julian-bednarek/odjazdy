import Toybox.Background;
import Toybox.Lang;
import Toybox.System;

(:background)
class TrainServiceDelegate extends System.ServiceDelegate {
    function initialize() {
        ServiceDelegate.initialize();
    }

    function onTemporalEvent() as Void {
        if (!Api.request(method(:onResponse))) {
            Background.exit(null);
        }
    }

    function onResponse(code as Number, data as Dictionary or String or Null) as Void {
        Background.exit(Api.accept(code, data));
    }
}
