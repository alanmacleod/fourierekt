
const BITTREX_PROXY = "http://localhost:3000/";
const CHART_WIDTH = 1200, CHART_HEIGHT= 600;
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

var pair = "BTC-SC";
var exchange = "BITTREX"
const INTERVALS = [
  ["oneMin", '1m'],
  ["fiveMin", '5m'],
  ["thirtyMin", '30m'],
  ["hour", '1H'],
  ["day", '1D'],
];

var interval = INTERVALS[1];

var url = `${BITTREX_PROXY}?marketName=${pair}&tickInterval=${interval[0]}&_=1499127220008`

console.info("Proxying to BITTREX...");

var fourier = new Fourier();

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
  var offset = (MAX_DISPLAY_BARS/2)>>0;

  // how many bars to render on screen
  var numbars = MAX_DISPLAY_BARS;
  var bars = r.result.reverse();

  var res = fourier.extrapolate(bars);

  console.log(res.past.data);
  console.log(res.past.offset);
  console.log(res.future.data);
  console.log(res.future.offset);

  var end = Math.max(offset - (numbars-1), 0);


  var output = [];

  // Extract the time-windowed data
  for (var t=offset; t>=end; t--)
    output.push(bars[t]);

  // Find windowed price range for auto scaling
  var range = [ Math.min.apply(Math,output.map(function(o){return o.L;})),
                  Math.max.apply(Math,output.map(function(o){return o.H;}))];

  draw_chart(output, range);
  draw_fourier(offset, res, range);

  ctx.font = "14px Courier";
  ctx.fillStyle = 'yellow';
  ctx.fillText(`${pair}`,10,20);
  ctx.fillStyle = 'white';
  ctx.fillText(`${exchange}, ${interval[1]}`,10,40);

}


function draw_fourier(screen_column_latest, f, range)
{
  var past_coords = [];
  for (var t=0; t<f.past.data.length; t++)
  {
    var column_x = (((screen_column_latest - t) + f.past.offset) * BAR_FOOTPRINT)>>0;
    if (column_x < 0) break;// {console.log(t, column, "BREAK"); break;}
    var price_y = ((1 - logical(f.past.data[t], range)) * CHART_HEIGHT)>>0;
    // console.log(column, price_y);
    past_coords.push([column_x, price_y]);
  }

  var future_coords = [];

  for (var t=0; t<f.future.data.length; t++)
  {
    var column_x = (((screen_column_latest + t) + f.past.offset) * BAR_FOOTPRINT)>>0;
    if (column_x > 1200) break;
    var price_y = ((1 - logical(f.future.data[t], range)) * CHART_HEIGHT)>>0;
    future_coords.push([column_x, price_y]);
  }

  ctx.lineWidth = 2;

  for (var t=0; t<past_coords.length-1; t++)
  {
    var p1 = past_coords[t];
    var p2 = past_coords[t+1];

    ctx.strokeStyle = "white";
    ctx.beginPath();
    ctx.moveTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.stroke();

  }


  for (var t=0; t<future_coords.length-1; t++)
  {
    var p1 = future_coords[t];
    var p2 = future_coords[t+1];

    ctx.strokeStyle = "blue";
    ctx.beginPath();
    ctx.moveTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.stroke();

  }

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
