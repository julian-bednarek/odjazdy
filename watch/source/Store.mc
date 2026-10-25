import Toybox.Application;
import Toybox.Cryptography;
import Toybox.Lang;
import Toybox.Time;

(:background :glance)
module Store {
    const SECRET_BYTES = 16;
    const MANUAL_PROFILE_TTL_S = 3600;

    const KEY_SECRET = "secret";
    const KEY_RESPONSE = "response";
    const KEY_FETCHED_AT = "fetchedAt";
    const KEY_MANUAL_PROFILE = "manualProfile";
    const KEY_MANUAL_PROFILE_AT = "manualProfileAt";

    function secret() as ByteArray? {
        return Storage.getValue(KEY_SECRET) as ByteArray?;
    }

    // Foreground only: the background process can't write Storage.
    function ensureSecret() as Void {
        if (secret() == null) {
            Storage.setValue(KEY_SECRET, Cryptography.randomBytes(SECRET_BYTES));
        }
    }

    function response() as Api.Response? {
        return Storage.getValue(KEY_RESPONSE) as Api.Response?;
    }

    function fetchedAt() as Number {
        var at = Storage.getValue(KEY_FETCHED_AT) as Number?;
        return at != null ? at : 0;
    }

    function saveResponse(data as Api.Response) as Void {
        Storage.setValue(KEY_RESPONSE, data as Dictionary<Storage.KeyType, Storage.ValueType>);
        Storage.setValue(KEY_FETCHED_AT, Time.now().value());
    }

    function manualProfile() as String? {
        var at = Storage.getValue(KEY_MANUAL_PROFILE_AT) as Number?;
        if (at == null || Time.now().value() - at > MANUAL_PROFILE_TTL_S) {
            return null;
        }
        return Storage.getValue(KEY_MANUAL_PROFILE) as String?;
    }

    function setManualProfile(id as String) as Void {
        Storage.setValue(KEY_MANUAL_PROFILE, id);
        Storage.setValue(KEY_MANUAL_PROFILE_AT, Time.now().value());
    }
}
