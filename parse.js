define([
	"./foreach",
	"require",
	"./template"
], function(bind, require){
	var undef,
		qsa,
		dataBindAttr = "data-mvc-bindings",
		dataBindTypeAttr = "data-mvc-binding-type",
		foreachParam = "foreach",
		ElementBinding = bind.Element;

	function evalParamsWithBindingList(attr, list){
		with(list){
			return eval("({" + attr + "})");
		}
	}

	function evalParamWithBindingList(attr, list){
		with(list){
			return eval(attr);
		}
	}

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

	function getListenerWithBinding(viewModelBinding, binding, listener){
		return function listenerWithBinding(){
			return listener.apply(this, [].slice.apply(arguments).concat([binding, viewModelBinding]));
		};
	}

	var origParse = ElementBinding.prototype.parse;
	ElementBinding.prototype.parse = function(){
		var types = [],
			element = this.element,
			source = this.source,
			ret = origParse.apply(this, arguments);

		qsa = qsa === undef ? !!element.querySelectorAll : qsa;

		for(var nodes = qsa ? element.querySelectorAll("[" + dataBindTypeAttr + "]") : element.getElementsByTagName("*"), i = 0, l = nodes.length; i < l; i++){
			var node = nodes[i],
				attr = node.getAttribute(dataBindTypeAttr);
			attr && types.push(attr);
		}

		require(types, function(){
			var bound,
				list = [];
			for(var nodes = qsa ? element.querySelectorAll("[" + dataBindAttr + "], [" + dataBindTypeAttr + "]") : element.getElementsByTagName("*"), i = 0, l = nodes.length; i < l; i++){
				list.push(bind(nodes[i]).evaluate(source));
			}
			while(bound = list.shift()){
				bound.startup && bound.startup();
			}
		});

		return ret;
	};

	var origForeach = ElementBinding.prototype.foreach;
	ElementBinding.prototype.foreach = function(){
		var element = this.element,
			args = [].slice.call(arguments),
			self = this;
		this.get("template").getValue(function(templateString){
			function createChild(entry){
				var container = document.createElement(element.tagName);
				container.innerHTML = templateString;
				var templateElement = container.removeChild(container.firstChild);
				if(templateElement.nodeType != 1){
					throw new Error("Invalid template: " + templateString);
				}
				var typeAttr = templateElement.getAttribute(dataBindTypeAttr);
				require(typeAttr ? [typeAttr] : [], function(){
					var binding = bind(templateElement).use(bind.container).evaluate(entry);
					templateElement.parentNode && binding.startup && binding.startup(); // If the DOM node has already been inserted before lazy loading finishes, start it up
				});
				return templateElement;
			}
			function insertedChild(element){
				var clz,
					typeAttr = element.getAttribute(dataBindTypeAttr);
				try{
					clz = require(typeAttr);
				}catch(e){}
				if(clz){ // If the class has been ready at the time DOM node is inserted, create and start up the binding
					var binding = bind(element);
					binding.startup && binding.startup();
				}
			}
			!self.using(bind.createChild) && templateString && self.use(bind.createChild, createChild);
			!self.using(bind.insertedChild) && self.use(bind.insertedChild, insertedChild);
			origForeach.apply(self, args);
		});
		return this;
	};

	ElementBinding.prototype.evaluate = function(viewModelBinding){
		var element = this.element,
			bindAttr = element.getAttribute(dataBindAttr);
		viewModelBinding = bind(viewModelBinding);
		if(bind.isContainer(element)){
			this.source = viewModelBinding;
		}
		if(bindAttr){
			var params, param;
			if(bindAttr){
				try{
					params = evalParamsWithBindingList(bindAttr, viewModelBinding);
				}catch(e){
					param = evalParamWithBindingList(bindAttr, viewModelBinding);
				}
			}
			if(params){
				for(var s in params){
					if(/^on/.test(s)){
						this.own(on(element, s.substr(2), getListenerWithBinding(viewModelBinding, this, params[s])));
					}else if(s != foreachParam){
						this.get(s).to(params[s]);
					}
				}
				var collection = params[foreachParam];
				collection && this.use(bind.parent, viewModelBinding).foreach(collection);
			}else if(param){
				this.to(param);
			}
		}
		return bind.isContainer(element) ? this.parse() : this;
	};

	bind.register(function(object){
		var clz,
			attr = (object || {}).getAttribute && object.getAttribute(dataBindTypeAttr);
		try{
			clz = attr && require(attr);
		}catch(e){}
		return object && !object._binding && clz && new clz(object);
	});

	return bind;
});
