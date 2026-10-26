import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Time;
import Toybox.Time.Gregorian;

// What both views show, derived from the last worker response.
(:glance)
class Board {
    private const STALE_S = 40 * 60;
    private const DEPARTED_GRACE_S = 60;

    var error as String? = null;
    var unregistered as Boolean = false;
    var title as String = "";
    var color as ColorType = Graphics.COLOR_WHITE;
    var rows as Array<Array> = [];

    function initialize() {
        var resp = Store.response();
        if (Store.secret() == null) {
            error = Text.get(Rez.Strings.OpenApp);
        } else if (resp == null) {
            error = Text.get(Rez.Strings.Loading);
        } else if (resp[Api.ERROR] != null) {
            unregistered = Api.unregistered(resp);
            error = Text.get(unregistered ? Rez.Strings.NotConfigured : Rez.Strings.Unauthorized);
        }
        if (resp == null || error != null) {
            return;
        }
        var now = Time.now().value();
        var stale = (resp[Api.STALE] as Boolean) || now - Store.fetchedAt() > STALE_S;
        title = (resp[Api.NAME] as String) + (stale ? Text.STALE_MARK : "");
        color = (resp[Api.MATCHED] as Boolean) ? Graphics.COLOR_WHITE : Graphics.COLOR_LT_GRAY;
        var all = resp[Api.DEPARTURES] as Array<Array>;
        for (var i = 0; i < all.size(); i++) {
            if ((all[i][Row.TIME] as Number) >= now - DEPARTED_GRACE_S) {
                rows.add(all[i]);
            }
        }
    }
}

(:glance)
module Row {
    enum { TIME, DELAY, TRAIN, STATION, PLATFORM, CANCELLED }

    const COUNTDOWN_MAX_MIN = 60;

    function clock(row as Array) as String {
        var t = Gregorian.info(new Time.Moment(row[TIME] as Number), Time.FORMAT_SHORT);
        return t.hour.format("%02d") + ":" + t.min.format("%02d");
    }

    function status(row as Array) as String {
        if (cancelled(row)) {
            return Text.get(Rez.Strings.Cancelled);
        }
        var mins = ((row[TIME] as Number) - Time.now().value()) / 60;
        if (mins <= 0) {
            return Text.get(Rez.Strings.Now);
        }
        // Beyond an hour the departure time says enough.
        return mins < COUNTDOWN_MAX_MIN ? Lang.format(Text.get(Rez.Strings.InMinutes), [mins]) : "";
    }

    function delay(row as Array) as String {
        var minutes = row[DELAY] as Number;
        return minutes > 0 && !cancelled(row) ? Lang.format(Text.DELAY, [minutes]) : "";
    }

    function details(row as Array) as String {
        var platform = row[PLATFORM] as String;
        var text = (row[TRAIN] as String) + Text.SEPARATOR + (row[STATION] as String);
        return platform.length() > 0 ? text + Text.SEPARATOR + Lang.format(Text.get(Rez.Strings.Platform), [platform]) : text;
    }

    function cancelled(row as Array) as Boolean {
        return row[CANCELLED] as Boolean;
    }
}

(:glance)
module Draw {
    // Single line, vertically centred on y, cut with an ellipsis to maxWidth.
    // Returns the x where left-aligned text ends.
    function text(dc as Dc, x as Number, y as Numeric, font as FontType, str as String, color as ColorType, justify as Number, maxWidth as Number) as Number {
        var fitted = lines(dc, x, y, font, str, color, justify, maxWidth, 1);
        return x + dc.getTextWidthInPixels(fitted, font);
    }

    // Like text, but wraps onto up to count lines. Returns the text drawn.
    function lines(dc as Dc, x as Number, y as Numeric, font as FontType, str as String, color as ColorType, justify as Number, maxWidth as Number, count as Number) as String {
        var fitted = Graphics.fitTextToArea(str, font, maxWidth, count * dc.getFontHeight(font), true) as String;
        dc.setColor(color, Graphics.COLOR_TRANSPARENT);
        dc.drawText(x, y, font, fitted, justify | Graphics.TEXT_JUSTIFY_VCENTER);
        return fitted;
    }
}
