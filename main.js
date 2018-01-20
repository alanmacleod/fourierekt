
const BITTREX_PROXY = "http://localhost:3000/";
const CHART_WIDTH = 640, CHART_HEIGHT= 480;
const BAR_WIDTH = 3, BAR_PADDING = 4;
const BAR_FOOTPRINT = BAR_WIDTH + BAR_PADDING;

const MAX_DISPLAY_BARS = (CHART_WIDTH / BAR_FOOTPRINT)>>0;

var c = document.getElementById("chart");

c.width = CHART_WIDTH;
c.height = CHART_HEIGHT;
// match these - no display scaling
c.style.width = `${CHART_WIDTH}px`;
c.style.height = `${CHART_HEIGHT}px`;

var ctx = c.getContext("2d");

console.log(MAX_DISPLAY_BARS);

var pair = "USDT-BTC";
var interval = "thirtyMin";

var url = `${BITTREX_PROXY}?marketName=${pair}&tickInterval=${interval}&_=1499127220008`

console.info("Proxying to BITTREX...");

fetch(url).then(function(response) {
    var contentType = response.headers.get("content-type");
    if(contentType && contentType.includes("application/json")) {
      return response.json();
    }
    throw new TypeError("Invalid data - bad pair?");
  })
  .then(function(json) { render(json); });


function render(r)
{
  // which bar to render from left edge of the chart window onwards
  var offset = (MAX_DISPLAY_BARS / 2)>>0;

  // how many bars to render on screen
  var numbars = MAX_DISPLAY_BARS;
  var bars = r.result.reverse();

  var end = Math.max(offset - (numbars-1), 0);

  var output = [];

  // Extract the time-windowed data
  for (var t=offset; t>=end; t--)
    output.push(bars[t]);

  // Find windowed price range for auto scaling
  var range = [ Math.min.apply(Math,output.map(function(o){return o.L;})),
                  Math.max.apply(Math,output.map(function(o){return o.H;}))];

  draw_chart(output, range);
}

function draw_chart(output, range)
{
  // logical 0..1 price coordinate = (VAL - LOWER) / RANGE

  ctx.fillStyle = "000000";
  ctx.lineWidth = 1;
  ctx.fillRect(0, 0, CHART_WIDTH, CHART_HEIGHT);

  for (var t=0; t<output.length; t++)
  {
    var c = output[t];
    var candle = {
      O: logical(c.O, range),
      C: logical(c.C, range),
      H: logical(c.H, range),
      L: logical(c.L, range)
    };
    draw_candle(candle, t);
  }
}

function draw_candle(candle, position)
{
  var x = (position * BAR_FOOTPRINT)>>0;

  // '1 -' because computer display coords are upside down ^_^
  var wick_top = ((1 - candle.H) * CHART_HEIGHT)>>0;
  var wick_bottom = ((1 - candle.L) * CHART_HEIGHT)>>0;
  var body_top = ((1 - candle.O) * CHART_HEIGHT)>>0;
  var body_bottom = ((1 - candle.C) * CHART_HEIGHT)>>0;

  if (body_top > body_bottom) //upside down, remember
  {
    // console.log("body swap!");
    var temp = body_top;
    body_top = body_bottom;
    body_bottom = temp;
  }


  // Is our close less than our open? Oh snap! make it red then
  ctx.strokeStyle = (candle.C < candle.O) ? 'red' : 'green';

  ctx.beginPath();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fillRect(x, body_top, BAR_WIDTH, body_bottom - body_top);
  ctx.moveTo(x + 1,wick_top);
  ctx.lineTo(x + 1,wick_bottom);
  ctx.stroke();

}

function logical(price, range)
{
  return (price - range[0]) / (range[1] - range[0]);
}
