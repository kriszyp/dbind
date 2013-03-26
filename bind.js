define([], function(){
	function on(node, event, callback){
		var addEventListener = !!node.addEventListener;
		node[addEventListener ? "addEventListener" : "attachEvent"]((addEventListener ? "" : "on") + event, callback, false);
		var h = {
			remove: function(){
				h && node[addEventListener ? "removeEventListener" : "detachEvent"](event, callback, false);
				return h = null;
			}
		};
		return h;
	}

	function around(target, methodName, advice){
		var original = target[methodName],
			dispatcher = target[methodName] = function(){
				if(advice){
					advice.call(target, original, arguments);
				}
			};
		dispatcher.reconnect = function(to){
			if(original = to){
				to.next = dispatcher;
			}
		};
		if(original){
			original.next = dispatcher;
		}
		return {
			remove: function(){
				var next = (dispatcher || {}).next;
				if(next){
					next.reconnect(original);
				}else if(target[methodName] == dispatcher && (target[methodName] = original)){
					original.next = next;
				}
				return target = advice = original = dispatcher = null;
			}
		};
	}

	function createOwnFunc(method){
		function own(){
			for(var i = 0, l = arguments.length; i < l; ++i){
				(function(h){
					var destroyMethodName = typeof h != "object" ? "" :
						method && (method in h) ? method :
						"destroyRecursive" in h ? "destroyRecursive" : // For dijit/_WidgetBase
						"destroy" in h ? "destroy" : // For dijit/Destroyable
						"remove" in h ? "remove" :
						"";
					if(destroyMethodName){
						var odh = around(this, method || "destroy", function(original, args){
							h[destroyMethodName]();
							original.apply(this, args);
						}), hdh = around(h, destroyMethodName, function(original, args){
							original.apply(this, args);
							odh.remove();
							hdh.remove();
						});
					}
				}).call(this, arguments[i]);
			}
			return arguments;
		}
		return own;
	}

	// A basic binding to value, our base class
	function Binding(value){
		this.value= value;
		if(value){
			value._binding = this;
			this.own({
				remove: function(){
					(value || {})._binding = null;
				}
			});
		}
	}
	Binding.prototype = {
		receive: function(callback){
			// get the value of this binding, notifying the callback of changes
			var callbacks= this.callbacks;
			(callbacks || (this.callbacks = [])).push(callback);
			if(callbacks){
				if("value" in this){
					callback(this.value);
				}
			}else{
				var self = this;
				callbacks = this.callbacks;
				this.getValue(function(value){
					self.value = value;
					for(var i = 0; i < callbacks.length; i++){
						callbacks[i](value);
					}
				});
			}
			return {
				remove: function(){
					for(var i = callbacks.length - 1; i >= 0; --i){
						if(callbacks[i] == callback){
							callbacks.splice(i, 1);
						}
					}
				}
			};
		},
		getValue: function(callback){
			if(this.hasOwnProperty("value")){
				callback(this.value);
			}
		},
		get: function(key, callback){
			// use an existing child/property if it exists
			var value, child = this['_' + key] || 
				(this['_' + key] = this.own(this.hasOwnProperty("value") && typeof this.value == "object" ?
					(value = this.value[key]) && typeof value != "object" ? new PropertyBinding(this.value, key) :
						convertToBindable(value) : new Binding())[0]);
			if(callback){
				return child.receive(callback);
			}
			return child;
		},
		put: function(value){
			if(this.source){
				this.source.put(value);
			}
			value._binding = this;
			this.own({
				remove: function(){
					(value || {})._binding = null;
				}
			});
			this.is(value);
		},
		is: function(value){
			if(value !== this.value){
				this.value = value;
				if(typeof this.value == "object"){
					for(var i in value){
						if(i.charAt(0) != '_'){
							this.get(i).is(value[i]);
						}
					}
				}
				if(this.callbacks){
					for(var i = 0; i < this.callbacks.length; i++){
						this.callbacks[i](value);
					}
				}
			}
		},
		keys: function(callback){
			if(this.source){
				this.source.keys(callback);
			}
			for(var i in this.value){
				if(i.charAt(0) != '_'){
					callback(i, this.get(i));
				}			}
		},
		to: function(source, property){
			this.reset();
			source = convertToBindable(this.extend(source));
			if(property){
				source = source.get(property);
			}
			var self = this;
			this.source = source;
			this.resettable(source.receive(function(value){
				self.is(value);
			}));
			for(var i in this){
				if(i.charAt(0) == '_'){
					i = i.slice(1);
					var child = self.get(i);
					var sourceChild = source.get(i);
					if(child != sourceChild){
						child.to(sourceChild);
					}
				}
			}
			source.keys(function(i, sourceChild){
				if(!(('_' + i) in self)){
					var child = self.get(i);
					if(child != sourceChild){
						child.to(sourceChild);
					}
				}
			});
			return this;
		},
		extend: function(source){
			if(source.extension){
				for(var s in source){
					var prop = source[s];
					if(!/^(start|extension)$/.test(s)){
						if(this[s] && typeof prop == "function"){
							around(this, s, prop);
						}else{
							this[s] = prop;
						}
					}
				}
				source.start && source.start.call(this);
				source = new Binding(); // Set an empty binding as the source to work as a pass-thru binding
			}
			return source;
		},
		own: createOwnFunc(),
		resettable: createOwnFunc("reset"),
		reset: function(){},
		remove: function(){
			this.reset();
			this.destroyed = true;
		}
	};
	// StatefulBinding is used for binding to Stateful objects, particularly Dijit widgets
	function StatefulBinding(stateful){
		this.stateful = stateful;
		stateful._binding = this;
		this.own({
			remove: function(){
				(stateful || {})._binding = null;
			}
		});
	}
	StatefulBinding.prototype = new Binding({}); 
	StatefulBinding.prototype.to = function(source){
		Binding.prototype.to.apply(this, arguments);
		source = this.source;
		var stateful = this.stateful;
		this.resettable(source.receive(function(value){
			stateful.set('value', value);
		}));
		this.resettable(stateful.watch('value', function(property, oldValue, value){
			if(oldValue !== value){
				source.put(value);
			}
		}));
		return this;
	};
	StatefulBinding.prototype.get = function(key, callback){
		return this['_' + key] || (this['_' + key] = this.own(new StatefulPropertyBinding(this.stateful, key))[0]);
	};
	StatefulBinding.prototype.keys = function(callback){
		for(var i in this.stateful){
			if(i.charAt(0) != '_'){
				callback(i, this.get(i));
			}
		}
	};

	function StatefulPropertyBinding(stateful, name){
		this.stateful = stateful;
		this.name = name;
		var self = this;
		this.own(stateful.watch(name, function(name, old, current){
			self.value = current;
			if(old !== current){
				for(var callback, callbacks = (self.callbacks || []).slice(); callback = callbacks.shift();){
					callback(current);
				}
			}
		}));
	}
	StatefulPropertyBinding.prototype = new Binding;
	StatefulPropertyBinding.prototype.getValue = function(callback){
		callback(this.stateful.get(this.name));
	};
	StatefulPropertyBinding.prototype.is = function(value){
		// don't go through setters, it is bubbling up through the source
		this.stateful._changeAttrValue(this.name, value);
		//return Binding.prototype.is.call(this, value);
	}
	StatefulPropertyBinding.prototype.put = function(value){
		// put a value, go through setter
		this.stateful.set(this.name, value);
	}
	StatefulPropertyBinding.prototype.to = function(source, property){
		Binding.prototype.to.call(this, source, property);
		var source = this.source;
		this.resettable(this.stateful.watch(this.name, function(name, old, current){
			if(old !== current){
				source.put(current);
			}
		}));
		return this;
	};

	function ElementBinding(element){
		this.element= element;
		element._binding = this;
		this.own({
			remove: function(){
				(element || {})._binding = null;
			}
		});
	}
	ElementBinding.prototype = new Binding({});
	var checkable = {radio: 1, checkbox: 1};
	ElementBinding.prototype.is = function(value){
		var element = this.element;
		if(this.container || element.tagName == "FORM"){
			return Binding.prototype.is.call(this, value);
		};
		if("value" in element){
			if(element.type == "radio"){
				element.checked = element.value == value;
			}else if(element.type == "checkbox"){
				element.checked = value;
			}else{
				element.value = value || "";
			}
		}else{
			element.innerText = value || "";
		}
		this.oldValue = value;
	};
	var inputLike = {
		"INPUT":1,
		"SELECT":1,
		"TEXTAREA":1
	};
	ElementBinding.prototype.to = function(source){
		Binding.prototype.to.apply(this, arguments);
		source = this.source;
		var element = this.element;
		if(element.tagName == "FORM"){
			var binding = this;
			function findInputs(tag){
				var inputs = element.getElementsByTagName(tag);
				for(var i = 0; i < inputs.length; i++){
					var input = inputs[i];
					if(input.name){
						bind(input, binding.get(input.name));
					}
				}
			}
			findInputs("input");
			findInputs("select");
		}else if(element.tagName in inputLike){
			var value,
				binding = this;
			function onChange(){
				if(element.type == "radio"){
					if(element.checked){
						value = element.value;
					}else{
						return; // not checked, don't do anything
					}
				}else{
					value = element.type == "checkbox" ? element.checked : element.value;
				}
				source.put(typeof binding.oldValue == "number" && !isNaN(value) ? +value : value);
			}
			this.resettable(on(element, "change", onChange));
			if(element.getAttribute('data-continuous')){
				this.resettable(on(element, "keyup", onChange));
			}
		}
		return this;
	}
	ElementBinding.prototype.receive = function(callback){
		var h,
			element = this.element;
		if(this.container){
			return Binding.prototype.receive.call(this, callback);
		}
		if("value" in element){
			callback(element.value);
			h = on(element, "change", function(){
				callback(element.value);
			});
		}else{
			callback(element.innerText);
		}
		return {
			remove: function(){
				h && h.remove();
			}
		};
	};

	function ContainerExtension(){
		this.extension = this.container = true;
	}

	function ArrayBinding(){
		Binding.apply(this, arguments);
	}
	ArrayBinding.prototype = new Binding({});
	ArrayBinding.prototype.getValue = function(callback){
		var currentValues = [],
			updates = 0;
			length = this.value.length;
		// watch all the items, and return a resulting array whenever an item is updated
		for(var i = 0; i < length; i++){
			(function(i, source){
				when(source, function(value){
					currentValues[i] = value;
					updates++;
					if(updates >= length){
						callback(currentValues);
					}
				});
			})(i, this.value[i]);
		}
	}
	function PropertyBinding(object, name){
		this.object = object;
		this.name = name;
	}
	PropertyBinding.prototype = new Binding;
	PropertyBinding.prototype.getValue = function(callback){
		callback(this.object[this.name]);
	};
	PropertyBinding.prototype.put = function(value){
		this.object[this.name] = value;
		this.is(value);
	}
	function FunctionBinding(func, reverseFunc){
		this.func = func;
		this.reverseFunc = reverseFunc;
	}
	FunctionBinding.prototype = {
		receive: function(callback){
			if(callback){
				var func = this.func;
				return this.source.receive(function(value){
					callback(value.slice ? func.apply(this, value) : func(value));
				});
			}
		},
		get: function(key){
			return this[key] || (this[key] = this.own(new Binding('None'))[0]);
		},
		put: function(value){
			this.source && this.reverseFunc && this.source.put(this.reverseFunc(value));
		},
		is: function(){},
		to: function(source){
			this.source = bind.apply(this, [Binding.prototype.extend.call(this, source)].concat([].slice.call(arguments, 1)));
			return this;
		},
		keys: function(){}
	} 
	function convertToBindable(object){
		return object ?
			object._binding || 
				(object.get || object.extension ?
					object.is || object.extension ?
				 		object :
					 	new StatefulBinding(object) :
					object.nodeType ?
						new ElementBinding(object) :
						typeof object == "function" ?
							new FunctionBinding(object) :
							object instanceof Array ?
								new ArrayBinding(object) :
				 				new Binding(object))
			: new Binding(object);
	}
	function bind(to){
		// first convert target object to the bindable interface
		to = convertToBindable(to);
	
		for(var i = 1; i < arguments.length; i++){
			var arg = arguments[i];
			if(typeof arg == "object" || typeof arg == "function"){
				arg = convertToBindable(arguments[i]);
				to.to(arg);
			}else{
				to = to.get(arg);
			}
		}
		return to;
	};
	var nativeWatch = Object.prototype.watch;
	function get(object, key, callback){
		if(key.call){
			// get(object ,callback) form
			if(object.get){
				if(object.get.binding){
					object.get(key);
				}else{
					key(object.get('value'));
				}
			}else{
				key(object);
			}
		}else{
			var value;
			if(object.get){
				if(object.get.binding){
					object.get(key, callback);
				}else{
					key(object.get('value'));
					if(object.watch === nativeWatch){
						object.watch('value', key);
					}
				}
			}else{
				return new PropertyBinding(object, key);
			}
		}
	};
	bind.get = get;
	bind.Element = ElementBinding;
	bind.Container = ContainerExtension;
	bind.Binding = Binding;


	function when(value, callback){
		if(value && value.receive){
			return value.receive(callback);
		}
		return callback(value);
	}
	bind.when = when;

	return bind;
});