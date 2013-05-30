/*
 * openark_lchart.js
 * A line chart javascript implementation. Currently can read google line chart URLs (partial feature list).
 * Uses VML on Internet Explorer, and HTML <canvas> on all other browsers.
 * 
 * 
 * Released under the BSD license
 * 
 * Copyright (c) 2009-2010, Shlomi Noach
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 *  * Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 *  * Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 *  * Neither the name of the organization nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 *  
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

openark_lchart = function(container, options) {
	if (container.style.width == '')
		this.canvas_width = options.width;
	else
		this.canvas_width = container.style.width;
	if (container.style.height == '')
		this.canvas_height = options.height;
	else
		this.canvas_height = container.style.height;
	this.title_height = 0;
	this.chart_title = '';
	this.x_axis_values_height = 20;
	this.y_axis_values_width = 50;
	this.y_axis_tick_values = [];
	this.y_axis_tick_positions = [];
	this.x_axis_grid_positions = [];
	this.x_axis_label_positions = [];
	this.x_axis_labels = [];
	this.y_axis_min = 0;
	this.y_axis_max = 0;
	this.y_axis_round_digits = 0;
	this.multi_series = [];
	this.multi_series_dot_positions = [];
	this.series_invisibility = [];
	this.series_labels = [];
	this.series_legend_values = [];
	this.timestamp_legend_value = null;
	this.series_colors = openark_lchart.series_colors;
	this.tsstart = null;
	this.tsstep = null;
	
	this.container = container;
	
	this.isIE = false;
	this.current_color = null;
	
	this.skip_interactive = false;
	if (options.skipInteractive)
		this.skip_interactive = true;
	this.square_lines = false;
	if (options.squareLines)
		this.square_lines = true;
	
	this.recalc();
	
	return this;
};


openark_lchart.title_font_size = 10;
openark_lchart.title_color = '#505050';
openark_lchart.axis_color = '#707070';
openark_lchart.axis_font_size = 8;
openark_lchart.min_x_label_spacing = 32;
openark_lchart.legend_font_size = 9;
openark_lchart.legend_color = '#606060';
openark_lchart.legend_invisible_color = '#b0b0b0';
openark_lchart.series_line_width = 1.5;
openark_lchart.grid_color = '#e4e4e4';
openark_lchart.grid_thick_color = '#c8c8c8';
openark_lchart.position_pointer_color = '#808080';
openark_lchart.series_colors = ["#ff0000", "#ff8c00", "#4682b4", "#9acd32", "#dc143c", "#9932cc", "#ffd700", "#191970", "#7fffd4", "#808080", "#dda0dd"];
openark_lchart.google_simple_format_scheme = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";


openark_lchart.prototype.create_graphics = function() {
	this.interactive_legend = null;
	this.legend_values_containers = [];
	this.timestamp_value_container = null;
	this.canvas_shadow = null;
	this.position_pointer = null;
	this.container.innerHTML = '';
	
	this.isIE = (/MSIE/.test(navigator.userAgent) && !window.opera);

	this.container.style.position = 'relative';
	this.container.style.color = ''+openark_lchart.axis_color;
	this.container.style.fontSize = ''+openark_lchart.axis_font_size+'pt';
	this.container.style.fontFamily = 'Helvetica,Verdana,Arial,sans-serif';
	
	if (!this.skip_interactive)
	{
		var local_this = this;
		this.container.onmousemove = function(e) {
			local_this.on_mouse_move(e);
		};
		this.container.onmouseout = function(e) {
			local_this.on_mouse_out(e);
		};
//		this.timestamp_value_container.onclick = function (e) {
//			if (local_this.timestamp_value_container.innerHTML == '') {
//				local_this.square_lines = !_this.square_lines;
//				local_this.redraw();
//			}
//		}
	}
	if (this.isIE)
	{
		// Nothing to do here right now.
	}
	else
	{
		var canvas = document.createElement("canvas");
		canvas.setAttribute("width", this.canvas_width);
		canvas.setAttribute("height", this.canvas_height);
		
		this.canvas = canvas;

		this.container.appendChild(this.canvas);
	
		this.ctx = this.canvas.getContext('2d');
	}
	this.canvas_shadow = document.createElement("div");
	this.canvas_shadow.style.position = "absolute";
	this.canvas_shadow.style.top = "0";
	this.canvas_shadow.style.left = "0";
	this.canvas_shadow.style.width = this.canvas_width;
	this.canvas_shadow.style.height = this.canvas_height;
	this.container.appendChild(this.canvas_shadow);
};

openark_lchart.prototype.parse_url = function(url) {
	url = url.replace(/[+]/gi, " ");
	var params = {};
	
	var pos = url.indexOf("?");
	if (pos >= 0)
		url = url.substring(pos + 1);
	tokens = url.split("&");
	for (i = 0 ; i < tokens.length ; ++i)
	{
		param_tokens = tokens[i].split("=");
		if (param_tokens.length == 2)
		params[param_tokens[0]] = param_tokens[1];
	}
	return params;
};



openark_lchart.prototype.recalc = function() {
	this.chart_width = this.canvas_width - this.y_axis_values_width;
	this.chart_height = this.canvas_height - (this.x_axis_values_height + this.title_height);
	this.chart_origin_x = this.canvas_width - this.chart_width;
	this.chart_origin_y = this.title_height + this.chart_height;
	
	// Calculate y-ticks:
	this.y_axis_tick_values = [];
	this.y_axis_tick_positions = [];
	if (this.y_axis_max <= this.y_axis_min)
	{
		return;
	}
    // Find tick nice round steps.
	max_steps = Math.floor(this.chart_height / (openark_lchart.axis_font_size * 1.6));
    round_steps_basis = [1, 2, 5];
    step_size = null;
    pow = 0;
    
    for (power = -4; power < 10 && !step_size; ++power) {
    	for (i = 0 ; i < round_steps_basis.length && !step_size; ++i)
    	{
    		round_step = round_steps_basis[i] * Math.pow(10, power);
        	if ((this.y_axis_max - this.y_axis_min)/round_step < max_steps) {
        		step_size = round_step;
        		pow = power;
        	}
    	}
    }
	var tick_value = step_size*Math.ceil(this.y_axis_min/step_size);
	while (tick_value <= this.y_axis_max)
	{
		var display_tick_value = (pow >= 0 ? tick_value : tick_value.toFixed(-pow));
		this.y_axis_tick_values.push(display_tick_value);
		var tick_value_ratio = (tick_value - this.y_axis_min)/(this.y_axis_max - this.y_axis_min);
		this.y_axis_tick_positions.push(Math.floor(this.chart_origin_y - tick_value_ratio*this.chart_height));
		tick_value += step_size;
	}
	this.y_axis_round_digits = (pow >= 0 ? 0 : -pow);	
};

openark_lchart.prototype.read_google_url = function(url) {
	params = this.parse_url(url);
	// title:
	this.title_height = 0;
	if (params["chtt"])
	{
		this.chart_title = params["chtt"];
		this.title_height = 20;
	}
	// labels:
	if (params["chdl"])
	{
		var tokens = params["chdl"].split("|");
		this.series_labels = tokens;
	}
	if (params["chco"])
	{
		var tokens = params["chco"].split(",");
		this.series_colors = new Array(tokens.length);
		for (i = 0; i < tokens.length ; ++i)
			this.series_colors[i] = "#"+tokens[i];
	}
	// parse y-axis range:
	var tokens = params["chxr"].split(",");
	if (tokens.length >= 3)
	{
		this.y_axis_min = parseFloat(tokens[1]);
		this.y_axis_max = parseFloat(tokens[2]);
	}
	// Enough data to rebuild chart dimensions.
	this.recalc();
	// x (vertical) grids:
	var tokens = params["chg"].split(",");
	if (tokens.length >= 6)
	{
		var x_axis_step_size = parseFloat(tokens[0]);
		var x_offset = parseFloat(tokens[4]);
		this.x_axis_grid_positions = [];
		for(i = 0, chart_x_pos = 0; chart_x_pos < this.chart_width; ++i)
		{
			chart_x_pos = (x_offset + i*x_axis_step_size) * this.chart_width / 100;
			if (chart_x_pos < this.chart_width)
			{
				this.x_axis_grid_positions.push(Math.floor(chart_x_pos + this.chart_origin_x));
			}
		}
	}
	// x axis label positions:
	var tokens = params["chxp"].split("|");
	for (axis = 0; axis < tokens.length ; ++axis)
	{
		var axis_tokens = tokens[axis].split(",");
		var axis_number = parseInt(axis_tokens[0]);
		if (axis_number == 0)
		{
			this.x_axis_label_positions = new Array(axis_tokens.length - 1);
			for (i = 1; i < axis_tokens.length; ++i)
			{
				var label_position = parseFloat(axis_tokens[i]) * this.chart_width / 100.0;
				this.x_axis_label_positions[i - 1] = Math.floor(label_position + this.chart_origin_x);
			}
		}
	}
	// x axis labels:
	var tokens = params["chxl"].split("|");
	// I'm doing a shortcut here. I'm expecting a single axis! This is because the chxl parameter is not trivial to parse.
	// The following will FAIL when more than one axis is provided!
	if (tokens[0] == '0:')
	{
		this.x_axis_labels = new Array(tokens.length - 1);
		for (i = 1; i < tokens.length; ++i)
		{
			this.x_axis_labels[i - 1] = tokens[i];
		}
	}
	if (params["chd"])
	{
		var chd = params["chd"];
		var data_format = null;
		var chd_format_token = chd.substring(0, 2);
		if (chd_format_token == "s:")
			data_format = "simple";
		else if (chd_format_token == "t:")
			data_format = "text";
		if (data_format)
		{
			this.multi_series = [];
			this.multi_series_dot_positions = [];
		}
		if (data_format == "simple")
		{
			this.skip_interactive = true;
			
			chd = chd.substring(2);
			var tokens = chd.split(",");
			this.multi_series = new Array(tokens.length);
			this.multi_series_dot_positions = new Array(tokens.length);
			
			for (series_index = 0; series_index < tokens.length ; ++series_index)
			{
				var series_encoded_data = tokens[series_index];
				
				var series = new Array(series_encoded_data.length);
				var series_dot_positions = new Array(series_encoded_data.length);
				for (i = 0 ; i < series_encoded_data.length ; ++i)
				{
					var series_encoded_current_data = series_encoded_data.charAt(i);
					if (series_encoded_current_data == '_')
					{
						series[i] = null;
						series_dot_positions[i] = null;
					}
					else
					{
						var x_value_scale_ratio = openark_lchart.google_simple_format_scheme.indexOf(series_encoded_current_data)/61;
						var x_value = this.y_axis_min + x_value_scale_ratio*(this.y_axis_max-this.y_axis_min);
						series[i] = x_value;
						series_dot_positions[i] = Math.round(this.chart_origin_y - x_value_scale_ratio*this.chart_height);
					}
				}
				this.multi_series[series_index] = series;
				this.multi_series_dot_positions[series_index] = series_dot_positions;
			}
		}
		if (data_format == "text")
		{
			chd = chd.substring(2);
			var tokens = chd.split("|");
			this.multi_series = new Array(tokens.length);
			this.multi_series_dot_positions = new Array(tokens.length);
			
			for (series_index = 0; series_index < tokens.length ; ++series_index)
			{
				var series_data = tokens[series_index];
				var series_data_tokens = series_data.split(",");
				
				var series = new Array(series_data_tokens.length);
				var series_dot_positions = new Array(series_data_tokens.length);
				for (i = 0 ; i < series_data_tokens.length ; ++i)
				{
					var series_data_current_token = series_data_tokens[i];
					if (series_data_current_token == '_')
					{
						series[i] = null;
						series_dot_positions[i] = null;
					}
					else
					{
						series[i] = parseFloat(series_data_current_token);
						var x_value_scale_ratio = 0.0;
						if (this.y_axis_max > this.y_axis_min)
						{
							if (series[i] < this.y_axis_min)
								x_value_scale_ratio = 0.0;
							else if (series[i] > this.y_axis_max)
								x_value_scale_ratio = 1.0;
							else
								x_value_scale_ratio = (series[i] - this.y_axis_min)/(this.y_axis_max - this.y_axis_min);
						}
						series_dot_positions[i] = Math.round(this.chart_origin_y - x_value_scale_ratio*this.chart_height);
					}
				}
				this.multi_series[series_index] = series;
				this.multi_series_dot_positions[series_index] = series_dot_positions;
			}
		}
	}
	if (params["tsstart"])
	{
		tsstart_text = params["tsstart"].replace(/-/g, "/");
		this.tsstart = new Date(tsstart_text);
	}
	if (params["tsstep"])
		this.tsstep = parseInt(params["tsstep"]);

	this.redraw();
};

openark_lchart.prototype.redraw = function() {
	this.create_graphics();
	this.draw();
};

openark_lchart.prototype.create_value_container = function() {
	var legend_value_container = document.createElement("div");
	legend_value_container.style.display = 'inline';
	legend_value_container.style.position = 'absolute';
	legend_value_container.style.right = '' + 0 + 'px';
	legend_value_container.style.textAlign = 'right';
	legend_value_container.style.fontWeight = 'bold';
	return legend_value_container;
}

openark_lchart.prototype.draw = function() {
	// Title
	if (this.chart_title)
	{
		var options = {
				text: this.chart_title, 
				left: 0, 
				top: 0, 
				width: this.canvas_width, 
				height: this.title_height, 
				text_align: 'center', 
				font_size: openark_lchart.title_font_size
			};
		if (this.chart_title.search('STALE DATA') >= 0)
		{
			options['background'] = '#ffcccc';
		}
		this.draw_text(options);
	}
	this.set_color(openark_lchart.grid_color);
	// y (horiz) grids:
	for (i = 0 ; i < this.y_axis_tick_positions.length ; ++i)
	{
		this.draw_line(this.chart_origin_x, this.y_axis_tick_positions[i], this.chart_origin_x + this.chart_width - 1, this.y_axis_tick_positions[i], 1);
	}
	// x (vertical) grids:
	for (i = 0 ; i < this.x_axis_grid_positions.length ; ++i)
	{
		if (this.x_axis_labels[i].replace(/ /gi, ""))
			this.set_color(openark_lchart.grid_thick_color);
		else
			this.set_color(openark_lchart.grid_color);
		this.draw_line(this.x_axis_grid_positions[i], this.chart_origin_y, this.x_axis_grid_positions[i], this.chart_origin_y - this.chart_height + 1, 1);
	}
	this.set_color(openark_lchart.axis_color);
	// x (vertical) ticks & labels:
	var last_drawn_x_axis_label_position = 0;
	for (i = 0 ; i < this.x_axis_label_positions.length ; ++i)
	{
		var label = this.x_axis_labels[i];
		var trimmed_label = label.replace(/ /gi, "");
		                            
		if (label && ((last_drawn_x_axis_label_position == 0) || (this.x_axis_label_positions[i] - last_drawn_x_axis_label_position >= openark_lchart.min_x_label_spacing) || !trimmed_label))
		{
			// x-ticks:
			this.draw_line(this.x_axis_label_positions[i], this.chart_origin_y, this.x_axis_label_positions[i], this.chart_origin_y + 3, 1);
		
			// x-labels:
			if (trimmed_label)
			{
				this.draw_text({
					text: ''+label, 
					left: this.x_axis_label_positions[i] - 25, 
					top: this.chart_origin_y + 5, 
					width: 50, 
					height: openark_lchart.axis_font_size, 
					text_align: 'center', 
					font_size: openark_lchart.axis_font_size
				});
				// Space-only labels do not count here: they do not signify a change in last drawn label position
				last_drawn_x_axis_label_position = this.x_axis_label_positions[i];
			}
		}
	}
	// series:
	for (series = 0 ; series < this.multi_series_dot_positions.length ; ++series)
	{
		if (this.series_invisibility[''+series])
			continue;
		
		var paths = [];
		paths.push([]);
		this.set_color(this.series_colors[series]);
		var series_dot_positions = this.multi_series_dot_positions[series];
		for (i = 0 ; i < series_dot_positions.length ; ++i)
		{
			if (series_dot_positions[i] == null)
			{
				// New path due to null value
				paths.push([]);
			}
			else
			{
				if (this.square_lines) {
					var x_pos = Math.round(this.chart_origin_x + i*this.chart_width/series_dot_positions.length);
					paths[paths.length-1].push({
						x: x_pos,
						y: series_dot_positions[i]
					});
					x_pos = Math.round(this.chart_origin_x + (i+1)*this.chart_width/series_dot_positions.length);
					paths[paths.length-1].push({
						x: x_pos,
						y: series_dot_positions[i]
					});				
				}
				else {
					var x_pos = Math.round(this.chart_origin_x + i*this.chart_width/(series_dot_positions.length-1));
					paths[paths.length-1].push({
						x: x_pos,
						y: series_dot_positions[i]
					});
				}
			}
		}
		for (path = 0; path < paths.length; ++path)
			this.draw_line_path(paths[path], openark_lchart.series_line_width);
	}
	// axis lines
	this.set_color(openark_lchart.axis_color);
	this.draw_line(this.chart_origin_x, this.chart_origin_y, this.chart_origin_x, this.chart_origin_y - this.chart_height + 1, 1);
	this.draw_line(this.chart_origin_x, this.chart_origin_y, this.chart_origin_x + this.chart_width - 1, this.chart_origin_y, 1);
	var y_axis_labels = '';
	for (i = 0 ; i < this.y_axis_tick_positions.length ; ++i)
	{
		// y-ticks:
		this.draw_line(this.chart_origin_x, this.y_axis_tick_positions[i], this.chart_origin_x-3, this.y_axis_tick_positions[i], 1);
		// y-labels:
		this.draw_text({
			text: ''+this.y_axis_tick_values[i], 
			left: 0, 
			top: this.y_axis_tick_positions[i] - openark_lchart.axis_font_size + Math.floor(openark_lchart.axis_font_size/3), 
			width: this.y_axis_values_width - 5, 
			height: openark_lchart.axis_font_size, 
			text_align: 'right', 
			font_size: openark_lchart.axis_font_size
		}); 
	}
	//// Bottom right indicator for most recent measurement hover
	//this.set_color(openark_lchart.axis_color);
	//this.draw_line(this.chart_origin_x + this.chart_width - 2, this.chart_origin_y + this.x_axis_values_height - 5 - 8, this.chart_origin_x + this.chart_width - 2, this.chart_origin_y + this.x_axis_values_height - 5, 1);
	//this.draw_line(this.chart_origin_x + this.chart_width - 2, this.chart_origin_y + this.x_axis_values_height - 5, this.chart_origin_x + this.chart_width - 2 - 6, this.chart_origin_y + this.x_axis_values_height - 5, 1)

	// legend:
	if (this.series_labels && this.series_labels.length)
	{
		if (this.isIE)
		{
			// Since all drawings are done via VML and absolute positions, the 
			// entire container becomes dimensionless. We now force its dimensions:
			// We add a place holder for the "canvas", then add the legend div.
			var placeholder_div = document.createElement("div");
			placeholder_div.style.width = this.canvas_width;
			placeholder_div.style.height = this.canvas_height;
			this.container.appendChild(placeholder_div);
		}
		var legend_div = document.createElement("div");

		var legend_ul = document.createElement("ul");
		legend_ul.style.margin = 0;
		legend_ul.style.paddingLeft = this.chart_origin_x;
		if (this.tsstart)
		{
			var legend_li = document.createElement("li");
			legend_li.style.listStyleType = 'none';
			legend_li.style.fontSize = ''+openark_lchart.legend_font_size+'pt';
			legend_li.innerHTML = '&nbsp;';
			this.timestamp_value_container = this.create_value_container();
			this.timestamp_value_container.style.cursor = 'pointer';
			if (!this.skip_interactive)
			{
				var local_this = this;
				this.timestamp_value_container.onclick = function (e) {
					local_this.square_lines = !local_this.square_lines;
					local_this.redraw();
				}
			}

			this.timestamp_value_container.innerHTML = '[type]';
			legend_li.appendChild(this.timestamp_value_container);
			
			legend_ul.appendChild(legend_li);
		}
		for (i = 0 ; i < this.series_labels.length ; ++i)
		{
			var legend_li = document.createElement("li");
			legend_li.style.listStyleType = 'square';
			legend_li.style.color = this.series_colors[i];
			legend_li.style.fontSize = ''+openark_lchart.legend_font_size+'pt';
			var text_color = openark_lchart.legend_color;
			if (this.series_invisibility[''+i])
				text_color = openark_lchart.legend_invisible_color;

			var legend_li_span = document.createElement("span");
			legend_li_span.className= ''+i;
			legend_li_span.style.cursor = 'pointer';
			legend_li_span.style.color = text_color;
			legend_li_span.innerHTML = this.series_labels[i];
			var local_this = this;
			legend_li_span.onclick = function (e) {
				local_this.series_invisibility[this.className] = !local_this.series_invisibility[this.className];
				local_this.redraw();
			}			
			legend_li.appendChild(legend_li_span);
			var legend_value_container = this.create_value_container();
			legend_value_container.style.width = '' + (this.chart_origin_x + 32) + 'px';
			legend_li.appendChild(legend_value_container);
			this.legend_values_containers.push(legend_value_container);
			
			legend_ul.appendChild(legend_li);
		}
		legend_div.appendChild(legend_ul);
		this.container.appendChild(legend_div);
		
		this.interactive_legend = document.createElement("ul");
		this.interactive_legend.style.position = 'relative';
		this.interactive_legend.style.right = '0px';
		this.interactive_legend.style.top = '0'+'px';
		legend_div.appendChild(this.interactive_legend);
	}
};


openark_lchart.prototype.set_color = function(color) {
	this.current_color = color;
	if (!this.isIE)
	{
		this.ctx.strokeStyle = color;
	}
};


openark_lchart.prototype.draw_line = function(x0, y0, x1, y1, lineWidth) {
	if (this.isIE)
	{
		var line_element = document.createElement("v:line");
		line_element.setAttribute("from", ' '+x0+' '+y0+' ');
		line_element.setAttribute("to", ' '+x1+' '+y1+' ');
		line_element.setAttribute("strokecolor", ''+this.current_color);
		line_element.setAttribute("strokeweight", ''+lineWidth+'pt');
		this.container.appendChild(line_element);
	}
	else
	{
		this.ctx.lineWidth = lineWidth;
		this.ctx.strokeWidth = 0.5;
		this.ctx.beginPath();
		this.ctx.moveTo(x0+0.5, y0+0.5);
		this.ctx.lineTo(x1+0.5, y1+0.5);
		this.ctx.closePath();
		this.ctx.stroke();
	}
};


openark_lchart.prototype.draw_line_path = function(coordinates, lineWidth) {
	if (coordinates.length == 0)
		return;
	if (coordinates.length == 1)
	{
		this.draw_line(coordinates[0].x - 2, coordinates[0].y, coordinates[0].x + 2, coordinates[0].y, lineWidth*0.8);
		this.draw_line(coordinates[0].x, coordinates[0].y - 2, coordinates[0].x, coordinates[0].y + 2, lineWidth*0.8);
		return;
	}
	if (this.isIE)
	{
		var polyline_element = document.createElement("v:polyline");
		var linear_coordinates = new Array(coordinates.length*2);
		for (i = 0; i < coordinates.length; ++i)
		{
			linear_coordinates[i*2] = coordinates[i].x;
			linear_coordinates[i*2 + 1] = coordinates[i].y;
		}
		var points = linear_coordinates.join(',');;
		polyline_element.setAttribute("points", points);
		polyline_element.setAttribute("stroked", "true");
		polyline_element.setAttribute("filled", "false");
		polyline_element.setAttribute("strokecolor", ''+this.current_color);
		polyline_element.setAttribute("strokeweight", ''+lineWidth+'pt');
		this.container.appendChild(polyline_element);
	}
	else
	{
		this.ctx.lineWidth = lineWidth;
		this.ctx.strokeWidth = 0.5;
		this.ctx.beginPath();
		this.ctx.moveTo(coordinates[0].x+0.5, coordinates[0].y+0.5);
		for (i = 1; i < coordinates.length; ++i)
		{
			this.ctx.lineTo(coordinates[i].x+0.5, coordinates[i].y+0.5);
		}
		this.ctx.stroke();
	}
};


openark_lchart.prototype.draw_text = function(options) {
	var label_div = document.createElement("div");
	label_div.style.position = 'absolute';
	label_div.style.left = ''+options.left+'px';
	label_div.style.top = ''+options.top+'px';
	label_div.style.width = ''+options.width+'px';
	label_div.style.height = ''+options.height+'px';
	label_div.style.textAlign =''+options.text_align;
	label_div.style.verticalAlign ='top';
	if (options.font_size)
		label_div.style.fontSize = ''+options.font_size+'pt';
	if (options.background)
		label_div.style.background = ''+options.background;
	label_div.innerHTML = options.text;
	this.container.appendChild(label_div);
};


openark_lchart.prototype.on_mouse_move = function(event) {
	// IE patch:
	if (!event) var event = window.event;
	
	var mouse_x = event.clientX - (findPosX(this.container) - (window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft || 0));
	// Make compatible across all browsers:
	var mouse_y = event.clientY - (findPosY(this.container) - (window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0));
	var chart_x = mouse_x - this.chart_origin_x;
	var chart_y = this.chart_origin_y - mouse_y;
	var mouse_inside_chart = ((chart_x <= this.chart_width) && (chart_y <= this.chart_height) && (chart_x >= 0) && (chart_y >= -20));
	var dot_position_index = Math.round((this.multi_series[0].length-1) * (chart_x / this.chart_width));
	// As special case, when mouse is right under chart (where x axis valus are), and close enough to the right edge, we enforce the 
	// dot position index to be the last index, meaning it will point to the last measurement in the chart. Reason is that this measurement
	// is more important than others (being last, i.e. current), and since catching the specific pixel with your mouse is not too easy.
	if ((chart_y < 0) && (chart_y >= -20) && (chart_x >= this.chart_width-10))
		dot_position_index = this.multi_series[0].length-1;
	
	if (mouse_inside_chart)
	{
		this.series_legend_values = new Array(this.multi_series.length);
		for (series = 0 ; series < this.multi_series.length ; ++series)
		{
			var value = this.multi_series[series][dot_position_index];
			if (value == null)
				this.series_legend_values[series] = 'n/a';
			else
			{
				// Data is in one order of magnitude more precise than scales.
				this.series_legend_values[series] = value.toFixed(this.y_axis_round_digits + 1);
			}
		}

		if (this.position_pointer == null)
		{
			this.position_pointer = document.createElement("div");
			this.position_pointer.style.position = 'absolute';
			this.position_pointer.style.top = '' + (this.chart_origin_y - this.chart_height)+ 'px';
			this.position_pointer.style.width = '2px';
			this.position_pointer.style.filter = 'alpha(opacity=60)';
			this.position_pointer.style.opacity = '0.6';
			this.position_pointer.style.height = '' + (this.chart_height) + 'px';
			this.position_pointer.style.backgroundColor = openark_lchart.position_pointer_color;

			this.canvas_shadow.appendChild(this.position_pointer);
		}
		if (this.tsstart)
		{
			var legend_date = new Date(this.tsstart);
			// The following avoids issues with summer time.
			if (this.tsstep % (60*60*24) == 0)
				legend_date.setDate(this.tsstart.getDate() + (this.tsstep / (60*60*24))*dot_position_index);
			else if (this.tsstep % (60*60) == 0)
				legend_date.setHours(this.tsstart.getHours() + (this.tsstep / (60*60))*dot_position_index);
			else if (this.tsstep % (60) == 0)
				legend_date.setMinutes(this.tsstart.getMinutes() + (this.tsstep / (60))*dot_position_index);
			else 
				legend_date.setSeconds(this.tsstart.getSeconds() + this.tsstep*dot_position_index);
			var is_long_format = (this.tsstep < 60*60*24); 
			this.timestamp_legend_value = format_date(legend_date, is_long_format);
		}
		this.update_legend();

		var position_pointer_x = Math.floor(this.chart_origin_x + dot_position_index*this.chart_width/(this.multi_series_dot_positions[0].length-1));
		this.position_pointer.style.visibility = 'visible';	
		this.position_pointer.style.left = '' + (position_pointer_x) + 'px';
	}
	else
	{
		this.clear_position_pointer_and_legend_values(event);
	}
}


openark_lchart.prototype.on_mouse_out = function(event) {
	// IE patch:
	if (!event) var event = window.event;
	
	if (event.relatedTarget == this.position_pointer)
	{
		// Because we're showing the position pointer on mouse move, it 
		// becomes the element under the mouse, which makes for an onmouseout 
		// event on the canvas_shadow... So this event is undesired in this case.
		return;
	}
	this.clear_position_pointer_and_legend_values(event);
}


openark_lchart.prototype.clear_position_pointer_and_legend_values = function(event) {
	if (this.position_pointer != null)
	{
		this.position_pointer.style.visibility = 'hidden';
	}
	this.series_legend_values = null;
	this.update_legend();
}


openark_lchart.prototype.update_legend = function() {
	if (this.tsstart)
	{
		if (this.series_legend_values == null)
			this.timestamp_value_container.innerHTML = '[type]';
		else
			this.timestamp_value_container.innerHTML = this.timestamp_legend_value.replace(/ /g, "&nbsp;");
	}
	for (i = 0 ; i < this.series_labels.length ; ++i)
	{
		if (this.series_legend_values == null)
		{
			this.legend_values_containers[i].innerHTML = '';
		}
		else
		{
			var percent = 0;
			if (this.y_axis_min < this.y_axis_max)
			{
				percent = 100.0*((this.series_legend_values[i] - this.y_axis_min) / (this.y_axis_max - this.y_axis_min));
			}
			this.legend_values_containers[i].innerHTML = '' + this.series_legend_values[i];
		}
	}
};


// From http://blog.firetree.net/2005/07/04/javascript-find-position/ and http://www.quirksmode.org/js/findpos.html
function findPosX(obj) {
	var curleft = 0;
	if (obj.offsetParent)
		while (1) {
			curleft += obj.offsetLeft;
			if (!obj.offsetParent)
				break;
			obj = obj.offsetParent;
		}
	else if (obj.x)
		curleft += obj.x;
	return curleft;
}

function findPosY(obj) {
	var curtop = 0;
	if (obj.offsetParent)
		while (1) {
			curtop += obj.offsetTop;
			if (!obj.offsetParent)
				break;
			obj = obj.offsetParent;
		}
	else if (obj.y)
		curtop += obj.y;
	return curtop;
}

function format_date(d, long_format) {
	pad = function (value, len) {
		var result = '' + value;
		while (result.length < len) 
			result = '0' + result;
		return result;
	};
	
	var result = "" + d.getFullYear() + "-" + pad(d.getMonth()+1, 2) + "-" + pad(d.getDate(), 2);
	if (long_format)
		result += " " + pad(d.getHours(), 2) + ":" + pad(d.getMinutes(), 2) ;
	return result;
}
