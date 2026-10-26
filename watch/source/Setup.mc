import Toybox.Communications;
import Toybox.Lang;
import Toybox.Time;
import Toybox.WatchUi;

// Opens the profile wizard on the phone through a one-time link from the worker.
module Setup {
    enum State { IDLE, CONNECTING, OPENED }

    const PATH_OPEN = "/open";
    const PAIR_PURPOSE = "pair";
    const SECRET = "secret";
    const CODE = "code";
    const CODE_PARAM = "c";
    const POLL_S = 20;
    const WAIT_S = 10 * 60;

    var state as State = IDLE;
    var openedAt as Number = 0;
    var polledAt as Number = 0;

    // An unpaired watch introduces itself with its secret; a paired one signs instead.
    function start() as Void {
        var secret = Store.secret();
        if (secret == null || state == CONNECTING) {
            return;
        }
        var callback = new Method(Setup, :onPaired);
        if (Api.unregistered(Store.response())) {
            Api.post(Api.PATH_PAIR, { SECRET => Auth.hex(secret) }, {}, callback);
        } else {
            var timestamp = Api.timestamp();
            Api.post(Api.PATH_PAIR, { Api.TIMESTAMP => timestamp }, Api.signed(secret, [timestamp, PAIR_PURPOSE]), callback);
        }
        state = CONNECTING;
        WatchUi.requestUpdate();
    }

    function onPaired(code as Number, data as Dictionary or String or Null) as Void {
        var pairing = code == 200 && data instanceof Dictionary ? (data as Dictionary)[CODE] : null;
        if (pairing instanceof String) {
            Communications.openWebPage(Api.url(PATH_OPEN), { CODE_PARAM => pairing }, null);
            state = OPENED;
            openedAt = Time.now().value();
            WatchUi.showToast(Rez.Strings.ContinueOnPhone, null);
        } else {
            state = IDLE;
            WatchUi.showToast(code == 401 ? Rez.Strings.Unauthorized : Rez.Strings.PairFailed, null);
        }
        WatchUi.requestUpdate();
    }

    function waiting() as Boolean {
        return state == OPENED && Time.now().value() - openedAt < WAIT_S;
    }

    // Picks up the profiles soon after they are saved on the phone.
    function poll() as Void {
        var now = Time.now().value();
        if (waiting() && now - polledAt >= POLL_S) {
            polledAt = now;
            Api.refresh(true);
        }
    }

    function hint() as String {
        if (state == CONNECTING) {
            return Text.get(Rez.Strings.Loading);
        }
        return Text.get(waiting() ? Rez.Strings.ContinueOnPhone : Rez.Strings.SetupHint);
    }
}
