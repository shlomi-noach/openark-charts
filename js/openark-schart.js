/*
 * openark_schart.js
 * A scatter chart javascript implementation. Currently can read google scatter chart URLs (partial feature list).
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

openark_schart = function(container, options) {
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
	this.x_axis_values_height = 30;
	this.y_axis_values_width = 35;
	this.x_axis_labels = [];
	this.x_axis_label_positions = [];
	this.y_axis_labels = [];
	this.y_axis_label_positions = [];
	this.dot_x_positions = [];
	this.dot_y_positions = [];
	this.dot_values = [];
	this.dot_colors = [];
	this.plot_colors = openark_schart.plot_colors;

	this.container = container;
	
	this.isIE = false;
	this.current_color = null;

	this.recalc();

	return this;
};

openark_schart.title_font_size = 10;
openark_schart.title_color = '#505050';
openark_schart.axis_color = '#707070';
openark_schart.axis_font_size = 8;
openark_schart.plot_colors = ["#9aed32", "#ff8c00"];
openark_schart.max_dot_size = 9;


openark_schart.prototype.recalc = function() {
	this.chart_width = this.canvas_width - this.y_axis_values_width	- openark_schart.max_dot_size;
	this.chart_height = this.canvas_height - (this.x_axis_values_height + this.title_height) - openark_schart.max_dot_size;
	this.chart_origin_x = this.y_axis_values_width;
	this.chart_origin_y = this.canvas_height - this.x_axis_values_height;
};


openark_schart.prototype.create_graphics = function() {
	this.container.innerHTML = '';
	
	this.isIE = (/MSIE/.test(navigator.userAgent) && !window.opera);

	this.container.style.position = 'relative';
	this.container.style.color = ''+openark_schart.axis_color;
	this.container.style.fontSize = ''+openark_schart.axis_font_size+'pt';
	this.container.style.fontFamily = 'Helvetica,Verdana,Arial,sans-serif';

	if (this.isIE)
	{
		// Since all drawings are done via VML and absolute positions, the 
		// entire container becomes dimensionless. We now force its dimensions.
		var placeholder_div = document.createElement("div");
		placeholder_div.style.width = this.canvas_width;
		placeholder_div.style.height = this.canvas_height;
		this.container.appendChild(placeholder_div);
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
};


openark_schart.prototype.hex_to_rgb = function(color_string) {
	if (color_string.substring(0, 1) == '#')
		color_string = color_string.substring(1);
	var rgb = [];
	color_string.replace(/(..)/g, function(str) {
		rgb.push(parseInt(str, 16));
	});
	return rgb;
};

openark_schart.prototype.toHex = function(n) {
	if (n == 0)
		return "00";
	return "0123456789abcdef".charAt((n - n % 16) / 16)
			+ "0123456789abcdef".charAt(n % 16);
};


openark_schart.prototype.rgb_to_hex = function(red, green, blue) {
	return '#' + this.toHex(red) + this.toHex(green) + this.toHex(blue);
};


openark_schart.prototype.gradient = function(color_string0, color_string1, percent) {
	var rgb0 = this.hex_to_rgb(color_string0);
	var rgb1 = this.hex_to_rgb(color_string1);

	return this.rgb_to_hex(
			Math.floor(rgb0[0] + (rgb1[0] - rgb0[0]) * percent / 100), 
			Math.floor(rgb0[1] + (rgb1[1] - rgb0[1]) * percent / 100),
			Math.floor(rgb0[2] + (rgb1[2] - rgb0[2]) * percent / 100));
};


openark_schart.prototype.parse_url = function(url) {
	url = url.replace(/[+]/gi, " ");
	var params = {};

	var pos = url.indexOf("?");
	if (pos >= 0)
		url = url.substring(pos + 1);
	tokens = url.split("&");
	for (i = 0; i < tokens.length; ++i) {
		param_tokens = tokens[i].split("=");
		if (param_tokens.length == 2)
			params[param_tokens[0]] = param_tokens[1];
	}
	return params;
};

openark_schart.prototype.read_google_url = function(url) {
	params = this.parse_url(url);
	// title:
	this.title_height = 0;
	if (params["chtt"]) {
		this.chart_title = params["chtt"];
		this.title_height = 20;
	}
	if (params["chco"]) {
		var tokens = params["chco"].split(",");
		this.plot_colors = [];
		for (i = 0; i < tokens.length; ++i)
			this.plot_colors.push("#" + tokens[i]);
	}
	// Enough data to rebuild chart dimensions.
	this.recalc();
	// x, y axis labels:
	if (params["chxl"])
	{
		var chxl = params["chxl"];
		var chxl_tokens = [];
		for(i = 0, pos = 0; pos >= 0; ++i)
		{
			pos = chxl.indexOf(""+i+":|");
			if (pos < 0)
			{
				chxl_tokens.push(chxl);
				break;
			}
			var token = chxl.substring(0, pos);
			if (token.length)
			{
				if (token.substring(token.length-1) == "|")
					token = token.substring(0, token.length-1);
				chxl_tokens.push(token);
			}
			chxl = chxl.substring(pos + 3);
		}
		this.x_axis_labels = chxl_tokens[0].split("|");
		this.x_axis_label_positions = [];
		for (i = 0 ; i < this.x_axis_labels.length ; ++i)
		{
			var x_pos = Math.floor(this.chart_origin_x + i * this.chart_width / (this.x_axis_labels.length -1));
			this.x_axis_label_positions.push(x_pos);
		}
		this.y_axis_labels = chxl_tokens[1].split("|");
		this.y_axis_label_positions = [];
		for (i = 0 ; i < this.y_axis_labels.length ; ++i)
		{
			var y_pos = Math.floor(this.chart_origin_y - i * this.chart_height / (this.y_axis_labels.length -1));
			this.y_axis_label_positions.push(y_pos);
		}		
	}
	
	if (params["chd"]) {
		var chd = params["chd"];
		var chd_format_token = chd.substring(0, 2);
		if (chd_format_token == "t:") {
			this.dot_x_positions = [];
			this.dot_y_positions = [];
			this.dot_values = [];
			this.dot_colors = [];

			chd = chd.substring(2);
			var tokens = chd.split("|");
			var x_positions = tokens[0].split(",");
			var y_positions = tokens[1].split(",");
			var values = null;
			if (tokens.length > 2)
			{
				values = tokens[2].split(",");
			}
			else
			{
				values = new Array(x_positions.length);
			}
			for (i = 0; i < values.length; ++i) {
				var x_pos = Math.floor(this.chart_origin_x + parseInt(x_positions[i]) * this.chart_width / 100);
				this.dot_x_positions.push(x_pos);
				var y_pos = Math.floor(this.chart_origin_y - parseInt(y_positions[i]) * this.chart_height / 100);
				this.dot_y_positions.push(y_pos);
				var value = null;
				if (values[i] && (values[i] != '_'))
					value = Math.floor(values[i] * openark_schart.max_dot_size / 100);
				this.dot_values.push(value);
				
				this.dot_colors.push(this.gradient(this.plot_colors[0], this.plot_colors[1], values[i]));
			}
		}
	}

	this.redraw();
};

openark_schart.prototype.redraw = function() {
	this.create_graphics();
	this.draw();
};

openark_schart.prototype.draw = function() {
	// title
	if (this.chart_title) {
		this.draw_text({
			text: this.chart_title, 
			left: 0, 
			top: 0, 
			width: this.canvas_width, 
			height: this.title_height, 
			text_align: 'center', 
			font_size: openark_schart.title_font_size
		});
	}
	// dots
	for (i = 0; i < this.dot_values.length; ++i) {
		if (this.dot_values[i] != null)
		{
			this.draw_circle(this.dot_x_positions[i], this.dot_y_positions[i], this.dot_values[i], this.dot_colors[i]);
		}
	}

	this.set_color(openark_schart.axis_color);
	// x axis labels
	for (i = 0; i < this.x_axis_label_positions.length; ++i) {
		if (this.x_axis_labels[i]) {
			// x-ticks:
			//this.draw_line(this.x_axis_label_positions[i], this.chart_origin_y + openark_schart.max_dot_size,	this.x_axis_label_positions[i], this.chart_origin_y + openark_schart.max_dot_size + 3, 1);

			// x-labels:
			this.draw_text({
				text: ''+this.x_axis_labels[i], 
				left: this.x_axis_label_positions[i] - 25,
				top: this.chart_origin_y + openark_schart.max_dot_size + 5,
				width: 50, 
				height: openark_schart.axis_font_size,
				text_align: 'center' 
			});
		}
	}
	// y axis labels
	for (i = 0; i < this.y_axis_label_positions.length; ++i) {
		if (this.y_axis_labels[i]) {
			// y-ticks:
			//this.draw_line(this.chart_origin_x - openark_schart.max_dot_size, this.y_axis_label_positions[i], this.chart_origin_x - openark_schart.max_dot_size - 3, this.y_axis_label_positions[i], 1);
			// y-labels:
			this.draw_text({
				text: ''+this.y_axis_labels[i], 
				left: 0,
				top: this.y_axis_label_positions[i] - openark_schart.axis_font_size + Math.floor(openark_schart.axis_font_size / 3),
				width: this.y_axis_values_width - openark_schart.max_dot_size - 5, 
				height: openark_schart.axis_font_size,
				text_align: 'right' 
			});
		}
	}
};


openark_schart.prototype.set_color = function(color) {
	this.current_color = color;
	if (!this.isIE)
	{
		this.ctx.strokeStyle = color;
	}
};


openark_schart.prototype.draw_circle = function(x, y, radius, color) {
	if (this.isIE)
	{
		var oval_element = document.createElement("v:oval");
		oval_element.style.position = 'absolute';
		oval_element.style.left = x-radius;
		oval_element.style.top = y-radius;
		oval_element.style.width = radius*2;
		oval_element.style.height = radius*2;
		oval_element.setAttribute("stroked", "false");
		oval_element.setAttribute("filled", "true");
		oval_element.setAttribute("fillcolor", ''+color);
		this.container.appendChild(oval_element);
	}
	else
	{
		this.ctx.fillStyle = this.dot_colors[i];
		this.ctx.beginPath();
		this.ctx.arc(x, y, radius, 0, Math.PI * 2, true);
		this.ctx.closePath();
		this.ctx.fill();
	}
};


openark_schart.prototype.draw_text = function(options) {
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
	label_div.innerHTML = options.text;
	this.container.appendChild(label_div);
};
