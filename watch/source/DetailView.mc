import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Time;
import Toybox.Timer;
import Toybox.WatchUi;

// Laid out for the 390×390 screen of the Forerunner 165.
class DetailView extends WatchUi.View {
    private const MARGIN = 60;
    private const TITLE_Y = 62;
    private const DIAGNOSTICS_Y = 98;
    private const MESSAGE_Y = 180;
    private const ERROR_Y = 140;
    private const SETUP_LABEL_Y = 190;
    private const SETUP_CODE_Y = 228;
    private const SETUP_LINE_HEIGHT = 36;
    private const SETUP_CODE_LINES = 2;
    private const FIRST_ROW_Y = 135;
    private const ROW_HEIGHT = 56;
    private const DETAILS_OFFSET_Y = 27;
    private const DELAY_GAP = 8;
    private const ATTRIBUTION_Y = 362;
    private const MAX_ROWS = 4;
    private const REDRAW_MS = 30000;
    private const COORDINATE_FORMAT = "%.3f";

    private var _timer as Timer.Timer = new Timer.Timer();

    function initialize() {
        View.initialize();
    }

    function onShow() as Void {
        Api.refresh(false);
        _timer.start(method(:onTick), REDRAW_MS, true);
    }

    function onHide() as Void {
        _timer.stop();
    }

    function onTick() as Void {
        WatchUi.requestUpdate();
    }

    function onUpdate(dc as Dc) as Void {
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_BLACK);
        dc.clear();
        var board = new Board();
        var error = board.error;
        if (error != null) {
            centered(dc, ERROR_Y, Graphics.FONT_SMALL, error, Graphics.COLOR_WHITE);
            drawSetupCode(dc);
            return;
        }
        centered(dc, TITLE_Y, Graphics.FONT_SMALL, board.title, board.color);
        centered(dc, DIAGNOSTICS_Y, Graphics.FONT_XTINY, diagnostics(), Graphics.COLOR_DK_GRAY);
        if (board.rows.size() == 0) {
            centered(dc, MESSAGE_Y, Graphics.FONT_SMALL, Text.get(Rez.Strings.NoTrains), Graphics.COLOR_WHITE);
        }
        for (var i = 0; i < board.rows.size() && i < MAX_ROWS; i++) {
            drawRow(dc, board.rows[i], FIRST_ROW_Y + i * ROW_HEIGHT);
        }
        centered(dc, ATTRIBUTION_Y, Graphics.FONT_XTINY, Text.get(Rez.Strings.Attribution), Graphics.COLOR_DK_GRAY);
    }

    private function drawRow(dc as Dc, row as Array, y as Number) as Void {
        var width = dc.getWidth() - 2 * MARGIN;
        var right = dc.getWidth() - MARGIN;
        var color = Row.cancelled(row) ? Graphics.COLOR_RED : Graphics.COLOR_WHITE;
        var x = Draw.text(dc, MARGIN, y, Graphics.FONT_MEDIUM, Row.clock(row), color, Graphics.TEXT_JUSTIFY_LEFT, width);
        Draw.text(dc, x + DELAY_GAP, y, Graphics.FONT_TINY, Row.delay(row), Graphics.COLOR_RED, Graphics.TEXT_JUSTIFY_LEFT, right - x);
        Draw.text(dc, right, y, Graphics.FONT_TINY, Row.status(row), color, Graphics.TEXT_JUSTIFY_RIGHT, width);
        Draw.text(dc, MARGIN, y + DETAILS_OFFSET_Y, Graphics.FONT_XTINY, Row.details(row), Graphics.COLOR_LT_GRAY, Graphics.TEXT_JUSTIFY_LEFT, width);
    }

    // Shown until the worker accepts this watch; registered with `npm run register`.
    private function drawSetupCode(dc as Dc) as Void {
        var secret = Store.secret();
        if (secret == null) {
            return;
        }
        var code = Auth.hex(secret);
        var lineLength = code.length() / SETUP_CODE_LINES;
        centered(dc, SETUP_LABEL_Y, Graphics.FONT_XTINY, Text.get(Rez.Strings.SetupCode), Graphics.COLOR_DK_GRAY);
        for (var i = 0; i < SETUP_CODE_LINES; i++) {
            var part = code.substring(i * lineLength, (i + 1) * lineLength) as String;
            centered(dc, SETUP_CODE_Y + i * SETUP_LINE_HEIGHT, Graphics.FONT_TINY, part, Graphics.COLOR_LT_GRAY);
        }
    }

    // Location source and data age, to judge how usable the weather-feed position is.
    private function diagnostics() as String {
        var location = Loc.current();
        var age = Lang.format(Text.get(Rez.Strings.Age), [(Time.now().value() - Store.fetchedAt()) / 60]);
        if (location == null) {
            return Text.get(Rez.Strings.NoLocation) + Text.SEPARATOR + age;
        }
        var position = location[2] + " " + location[0].format(COORDINATE_FORMAT) + ", " + location[1].format(COORDINATE_FORMAT);
        return position + Text.SEPARATOR + age;
    }

    private function centered(dc as Dc, y as Number, font as FontType, text as String, color as ColorType) as Void {
        Draw.text(dc, dc.getWidth() / 2, y, font, text, color, Graphics.TEXT_JUSTIFY_CENTER, dc.getWidth() - 2 * MARGIN);
    }
}

class DetailDelegate extends WatchUi.BehaviorDelegate {
    function initialize() {
        BehaviorDelegate.initialize();
    }

    function onNextPage() as Boolean {
        return switchProfile(1);
    }

    function onPreviousPage() as Boolean {
        return switchProfile(-1);
    }

    function onSelect() as Boolean {
        Api.refresh(true);
        return true;
    }

    private function switchProfile(step as Number) as Boolean {
        var resp = Store.response();
        if (resp == null || resp[Api.PROFILES] == null) {
            return false;
        }
        var ids = resp[Api.PROFILES] as Array<String>;
        var next = (ids.indexOf(resp[Api.PROFILE]) + step + ids.size()) % ids.size();
        Store.setManualProfile(ids[next]);
        Api.refresh(true);
        return true;
    }
}
