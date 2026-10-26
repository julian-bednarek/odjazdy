import Toybox.Graphics;
import Toybox.Lang;
import Toybox.WatchUi;

(:glance)
class TrainGlanceView extends WatchUi.GlanceView {
    private const TITLE_Y = 0.28;
    private const VALUE_Y = 0.7;
    private const GAP = 10;

    function initialize() {
        GlanceView.initialize();
    }

    function onShow() as Void {
        Api.refresh(false);
    }

    function onUpdate(dc as Dc) as Void {
        var board = new Board();
        var top = dc.getHeight() * TITLE_Y;
        var bottom = dc.getHeight() * VALUE_Y;
        var error = board.error;
        if (error != null) {
            line(dc, 0, top, error, Graphics.COLOR_LT_GRAY);
            return;
        }
        line(dc, 0, top, board.title, board.color);
        if (board.rows.size() == 0) {
            line(dc, 0, bottom, Text.get(Rez.Strings.NoTrains), board.color);
            return;
        }
        var row = board.rows[0];
        var color = Row.cancelled(row) ? Graphics.COLOR_RED : board.color;
        var x = line(dc, 0, bottom, Row.clock(row), color);
        x = line(dc, x + GAP, bottom, Row.status(row), color);
        line(dc, x + GAP, bottom, Row.delay(row), Graphics.COLOR_RED);
    }

    private function line(dc as Dc, x as Number, y as Numeric, text as String, color as ColorType) as Number {
        return Draw.text(dc, x, y, Graphics.FONT_GLANCE, text, color, Graphics.TEXT_JUSTIFY_LEFT, dc.getWidth() - x);
    }
}
