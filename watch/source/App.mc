import Toybox.Application;
import Toybox.Background;
import Toybox.Lang;
import Toybox.System;
import Toybox.Time;
import Toybox.WatchUi;

(:background :glance)
class TrainApp extends Application.AppBase {
    function initialize() {
        AppBase.initialize();
    }

    (:typecheck([disableBackgroundCheck, disableGlanceCheck]))
    function getInitialView() as [WatchUi.Views] or [WatchUi.Views, WatchUi.InputDelegates] {
        Store.ensureSecret();
        scheduleBackground();
        var view = new DetailView();
        return [view, new DetailDelegate(view)];
    }

    (:glance :typecheck(disableBackgroundCheck))
    function getGlanceView() as [WatchUi.GlanceView] or [WatchUi.GlanceView, WatchUi.GlanceViewDelegate] or Null {
        scheduleBackground();
        return [new TrainGlanceView()];
    }

    (:typecheck(disableGlanceCheck))
    function getServiceDelegate() as [System.ServiceDelegate] {
        return [new TrainServiceDelegate()];
    }

    function onBackgroundData(data as Application.PersistableType) as Void {
        if (data instanceof Dictionary) {
            Store.saveResponse(data);
            WatchUi.requestUpdate();
        }
    }

    // Registering again would restart the 30-minute countdown.
    private function scheduleBackground() as Void {
        if (Background.getTemporalEventRegisteredTime() == null) {
            Background.registerForTemporalEvent(new Time.Duration(30 * 60));
        }
    }
}
