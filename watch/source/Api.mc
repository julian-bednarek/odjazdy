import Toybox.Application;
import Toybox.Communications;
import Toybox.Lang;
import Toybox.Time;
import Toybox.WatchUi;

(:background :glance)
module Api {
    const MIN_REFRESH_S = 120;
    const COORDINATE_FORMAT = "%.3f";

    const PATH_DEPARTURES = "/v1/departures";
    const PATH_PAIR = "/v1/pair";

    const HEADER_CONTENT_TYPE = "Content-Type";
    const HEADER_DEVICE = "X-Device";
    const HEADER_SIGNATURE = "X-Signature";

    // Request fields, signed in this order; see worker/src/auth.ts.
    const TIMESTAMP = "timestamp";
    const LAT = "lat";
    const LON = "lon";
    const PROFILE = "profile";

    // Response fields, mirroring WatchResponse in worker/src/types.ts.
    const ERROR = "error";
    const NAME = "name";
    const MATCHED = "matched";
    const STALE = "stale";
    const PROFILES = "profiles";
    const DEPARTURES = "departures";

    const ERROR_NO_CONFIG = "no_config";

    typedef Response as Dictionary<Application.PropertyKeyType, Application.PropertyValueType>;
    typedef Callback as Method(responseCode as Number, data as Dictionary or String or Null) as Void;

    var inFlight as Boolean = false;

    function request(callback as Callback) as Boolean {
        var secret = Store.secret();
        if (secret == null) {
            return false;
        }
        var location = Loc.current();
        var profile = Store.manualProfile();
        var fields = [
            timestamp(),
            location != null ? location[0].format(COORDINATE_FORMAT) : "",
            location != null ? location[1].format(COORDINATE_FORMAT) : "",
            profile != null ? profile : ""
        ];
        var body = { TIMESTAMP => fields[0], LAT => fields[1], LON => fields[2], PROFILE => fields[3] };
        post(PATH_DEPARTURES, body, signed(secret, fields), callback);
        return true;
    }

    function post(path as String, body as Dictionary<Object, Object>, headers as Dictionary, callback as Callback) as Void {
        headers.put(HEADER_CONTENT_TYPE, Communications.REQUEST_CONTENT_TYPE_JSON);
        var options = {
            :method => Communications.HTTP_REQUEST_METHOD_POST,
            :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON,
            :headers => headers
        };
        Communications.makeWebRequest(url(path), body, options, callback);
    }

    function signed(secret as ByteArray, fields as Array<String>) as Dictionary {
        return { HEADER_DEVICE => Auth.deviceId(secret), HEADER_SIGNATURE => Auth.sign(secret, fields) };
    }

    function url(path as String) as String {
        return (Application.loadResource(Rez.Strings.WorkerUrl) as String) + path;
    }

    function timestamp() as String {
        return Time.now().value().toString();
    }

    function unregistered(resp as Response?) as Boolean {
        return resp != null && ERROR_NO_CONFIG.equals(resp[ERROR]);
    }

    // Answers worth keeping: data, or an error the screen should explain.
    function accept(code as Number, data as Dictionary or String or Null) as Response? {
        return (code == 200 || code == 401) && data instanceof Dictionary ? data as Response : null;
    }

    function refresh(force as Boolean) as Void {
        if (!inFlight && (force || Time.now().value() - Store.fetchedAt() >= MIN_REFRESH_S)) {
            inFlight = request(new Method(Api, :onResponse));
        }
    }

    function onResponse(code as Number, data as Dictionary or String or Null) as Void {
        inFlight = false;
        var response = accept(code, data);
        if (response != null) {
            Store.saveResponse(response);
        }
        WatchUi.requestUpdate();
    }
}
