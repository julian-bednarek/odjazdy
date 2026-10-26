import Toybox.Graphics;
import Toybox.Lang;
import Toybox.System;
import Toybox.Timer;
import Toybox.WatchUi;

// Laid out for the 390×390 screen of the Forerunner 165.
class DetailView extends WatchUi.View {
    private const MARGIN = 60;
    private const TITLE_Y = 68;
    private const MESSAGE_Y = 195;
    private const ERROR_Y = 140;
    private const SETUP_LABEL_Y = 190;
    private const SETUP_CODE_Y = 228;
    private const SETUP_LINE_HEIGHT = 36;
    private const SETUP_CODE_LINES = 2;
    private const FIRST_ROW_Y = 122;
    private const ROW_HEIGHT = 80;
    private const DETAILS_OFFSET_Y = 34;
    private const DELAY_GAP = 8;
    private const VISIBLE_ROWS = 3;
    private const SCROLLBAR_INSET = 8;
    private const SCROLLBAR_WIDTH = 4;
    private const SCROLLBAR_HALF_ARC = 30;
    private const REDRAW_MS = 30000;
    private const MARQUEE_TICK_MS = 50;
    private const MARQUEE_MS_PER_PX = 25;
    private const MARQUEE_PAUSE_MS = 1500;

    private var _timer as Timer.Timer = new Timer.Timer();
    private var _tickMs as Number = 0;
    private var _first as Number = 0;
    private var _maxFirst as Number = 0;

    function initialize() {
        View.initialize();
    }

    function onShow() as Void {
        Api.refresh(false);
        tickEvery(REDRAW_MS);
    }

    function onHide() as Void {
        _timer.stop();
        _tickMs = 0;
    }

    function onTick() as Void {
        WatchUi.requestUpdate();
    }

    function scroll(step as Number) as Void {
        var first = _first + step;
        _first = first < 0 ? 0 : (first > _maxFirst ? _maxFirst : first);
    }

    function resetScroll() as Void {
        _first = 0;
    }

    function onUpdate(dc as Dc) as Void {
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_BLACK);
        dc.clear();
        var board = new Board();
        var error = board.error;
        if (error != null) {
            centered(dc, ERROR_Y, Graphics.FONT_SMALL, error, Graphics.COLOR_WHITE);
            drawSetupCode(dc);
            tickEvery(REDRAW_MS);
            return;
        }
        var rows = board.rows;
        // Every departure can scroll to the top, where its details marquee.
        _maxFirst = rows.size() > 1 ? rows.size() - 1 : 0;
        scroll(0);
        centered(dc, TITLE_Y, Graphics.FONT_SMALL, board.title, board.color);
        if (rows.size() == 0) {
            centered(dc, MESSAGE_Y, Graphics.FONT_SMALL, Text.get(Rez.Strings.NoTrains), Graphics.COLOR_WHITE);
        }
        var animating = false;
        for (var i = 0; i < VISIBLE_ROWS; i++) {
            var index = _first + i;
            var y = FIRST_ROW_Y + i * ROW_HEIGHT;
            if (index < rows.size()) {
                animating = drawRow(dc, rows[index], y, i == 0) || animating;
            } else if (index == rows.size() && rows.size() > 0) {
                // PLK's terms ask for the data source wherever its data is shown.
                centered(dc, y, Graphics.FONT_XTINY, Text.get(Rez.Strings.Attribution), Graphics.COLOR_DK_GRAY);
            }
        }
        drawScrollbar(dc, rows.size() + 1);
        tickEvery(animating ? MARQUEE_TICK_MS : REDRAW_MS);
    }

    // Returns whether the row is mid-animation and needs fast redraws.
    private function drawRow(dc as Dc, row as Array, y as Number, focused as Boolean) as Boolean {
        var width = dc.getWidth() - 2 * MARGIN;
        var right = dc.getWidth() - MARGIN;
        var color = Row.cancelled(row) ? Graphics.COLOR_RED : (focused ? Graphics.COLOR_WHITE : Graphics.COLOR_LT_GRAY);
        var x = Draw.text(dc, MARGIN, y, Graphics.FONT_MEDIUM, Row.clock(row), color, Graphics.TEXT_JUSTIFY_LEFT, width);
        x = Draw.text(dc, x + DELAY_GAP, y, Graphics.FONT_TINY, Row.delay(row), Graphics.COLOR_RED, Graphics.TEXT_JUSTIFY_LEFT, right - x - DELAY_GAP);
        Draw.text(dc, right, y, Graphics.FONT_TINY, Row.status(row), color, Graphics.TEXT_JUSTIFY_RIGHT, right - x - DELAY_GAP);
        var details = Row.details(row);
        var detailsY = y + DETAILS_OFFSET_Y;
        if (focused) {
            return marquee(dc, MARGIN, detailsY, Graphics.FONT_TINY, details, Graphics.COLOR_LT_GRAY, width);
        }
        Draw.text(dc, MARGIN, detailsY, Graphics.FONT_TINY, details, Graphics.COLOR_DK_GRAY, Graphics.TEXT_JUSTIFY_LEFT, width);
        return false;
    }

    // Slides text wider than maxWidth to its end and jumps back, pausing at both ends.
    private function marquee(dc as Dc, x as Number, y as Number, font as FontType, str as String, color as ColorType, maxWidth as Number) as Boolean {
        var overflow = dc.getTextWidthInPixels(str, font) - maxWidth;
        if (overflow <= 0) {
            Draw.text(dc, x, y, font, str, color, Graphics.TEXT_JUSTIFY_LEFT, maxWidth);
            return false;
        }
        var period = 2 * MARQUEE_PAUSE_MS + overflow * MARQUEE_MS_PER_PX;
        var offset = (System.getTimer() % period - MARQUEE_PAUSE_MS) / MARQUEE_MS_PER_PX;
        offset = offset < 0 ? 0 : (offset > overflow ? overflow : offset);
        var height = dc.getFontHeight(font);
        dc.setClip(x, y - height / 2, maxWidth, height);
        dc.setColor(color, Graphics.COLOR_TRANSPARENT);
        dc.drawText(x - offset, y, font, str, Graphics.TEXT_JUSTIFY_LEFT | Graphics.TEXT_JUSTIFY_VCENTER);
        dc.clearClip();
        return true;
    }

    // An arc along the right edge, like the watch's own lists; total counts the footer too.
    private function drawScrollbar(dc as Dc, total as Number) as Void {
        if (_maxFirst == 0) {
            return;
        }
        var cx = dc.getWidth() / 2;
        var cy = dc.getHeight() / 2;
        var radius = cx - SCROLLBAR_INSET;
        var span = 2 * SCROLLBAR_HALF_ARC;
        var shown = total - _first < VISIBLE_ROWS ? total - _first : VISIBLE_ROWS;
        var start = SCROLLBAR_HALF_ARC - span * _first / total;
        dc.setPenWidth(SCROLLBAR_WIDTH);
        dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawArc(cx, cy, radius, Graphics.ARC_CLOCKWISE, SCROLLBAR_HALF_ARC, -SCROLLBAR_HALF_ARC);
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawArc(cx, cy, radius, Graphics.ARC_CLOCKWISE, start, start - span * shown / total);
        dc.setPenWidth(1);
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

    private function centered(dc as Dc, y as Number, font as FontType, text as String, color as ColorType) as Void {
        Draw.text(dc, dc.getWidth() / 2, y, font, text, color, Graphics.TEXT_JUSTIFY_CENTER, dc.getWidth() - 2 * MARGIN);
    }

    // Restarting the timer only on change keeps its phase steady between redraws.
    private function tickEvery(ms as Number) as Void {
        if (ms != _tickMs) {
            _timer.stop();
            _timer.start(method(:onTick), ms, true);
            _tickMs = ms;
        }
    }
}

// UP/DOWN scroll the departures; a left swipe switches profile, since a right swipe from the edge is Back.
class DetailDelegate extends WatchUi.BehaviorDelegate {
    private var _view as DetailView;

    function initialize(view as DetailView) {
        BehaviorDelegate.initialize();
        _view = view;
    }

    function onNextPage() as Boolean {
        return scroll(1);
    }

    function onPreviousPage() as Boolean {
        return scroll(-1);
    }

    function onSelect() as Boolean {
        Api.refresh(true);
        return true;
    }

    function onSwipe(swipeEvent as WatchUi.SwipeEvent) as Boolean {
        return swipeEvent.getDirection() == WatchUi.SWIPE_LEFT && nextProfile();
    }

    private function scroll(step as Number) as Boolean {
        _view.scroll(step);
        WatchUi.requestUpdate();
        return true;
    }

    private function nextProfile() as Boolean {
        var resp = Store.response();
        if (resp == null || resp[Api.PROFILES] == null) {
            return false;
        }
        var ids = resp[Api.PROFILES] as Array<String>;
        Store.setManualProfile(ids[(ids.indexOf(resp[Api.PROFILE]) + 1) % ids.size()]);
        _view.resetScroll();
        Api.refresh(true);
        return true;
    }
}
