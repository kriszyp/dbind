define([
	"./Stateful",
	"./parse",
	"dijit/registry",
	"./foreach",
	"./template"
], function(bind, parse, registry){
	var undef,
		dataBindAttr = "data-mvc-bindings",
		dataBindTypeAttr = "data-mvc-binding-type",
		foreachParam = "foreach",
		Binding = bind.Binding,
		StatefulBinding = bind.Stateful,
		StatefulPropertyBinding = bind.StatefulProperty,
		ElementBinding = bind.Element,
		ElementCollapsedBinding = bind.ElementCollapsed,
		ElementHiddenBinding = bind.ElementHidden,
		ElementClassBinding = bind.ElementClass,
		ElementAttributeBinding = bind.ElementAttribute,
		InlineTemplateBinding = bind.InlineTemplate;

	function WidgetBinding(){
		StatefulBinding.apply(this, arguments);
	}
	WidgetBinding.prototype = new StatefulPropertyBinding();
	WidgetBinding.prototype.create = function(){
		StatefulBinding.prototype.create.apply(this, arguments);
		StatefulPropertyBinding.prototype.create.call(this, this.object, "value");
		if(arguments.length > 0){
			this.element = this.object.domNode;
		}
	};
	WidgetBinding.prototype.get = function(key){
		var attrib,
			element = this.element;
		this['_' + key] ||
			(this['_' + key] = /^\.collapsed$/i.test(key) ? this.own(new ElementCollapsedBinding(element))[0] :
				/^\.hidden$/i.test(key) ? this.own(new ElementHiddenBinding(element))[0] :
				key.charAt(0) == '.' ? this.own(new ElementClassBinding(element, key.substr(1)))[0] :
				(attrib = (/^\[(.*)\]$/.exec(key) || [])[1]) ? this.own(new ElementAttributeBinding(element, attrib))[0] :
				key == "template" ? this.own(new InlineTemplateBinding(element))[0] :
				(key == "id" ? Binding : StatefulBinding).prototype.get.call(this, key));
		return Binding.prototype.get.apply(this, arguments);
	};
	WidgetBinding.prototype.to = function(){
		var result = StatefulPropertyBinding.prototype.to.apply(this, arguments);
		if(bind.isContainer(this.element)){
			this.parse();
		}
		return result;
	};
	WidgetBinding.prototype.parse = ElementBinding.prototype.parse;
	WidgetBinding.prototype.foreach = ElementBinding.prototype.foreach;
	WidgetBinding.prototype.resetForeach = function(){};
	WidgetBinding.prototype.startup = function(){
		!this.object._started && this.object.startup();
	};

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

	function getListenerWithBinding(viewModelBinding, binding, listener){
		return function listenerWithBinding(){
			return listener.apply(this, [].slice.apply(arguments).concat([binding, viewModelBinding]));
		};
	}

	function DeclaredWidgetBinding(){
		WidgetBinding.apply(this, arguments);
	}
	DeclaredWidgetBinding.prototype = new WidgetBinding();
	DeclaredWidgetBinding.prototype.create = function(element){
		this.element = element;
	};
	DeclaredWidgetBinding.prototype.evaluate = function(viewModelBinding){
		var element = this.element,
			clz = require(element.getAttribute(dataBindTypeAttr)),
			attr = element.getAttribute(dataBindAttr);
		viewModelBinding = bind(viewModelBinding);
		if(bind.isContainer(element)){
			this.source = viewModelBinding;
		}
		if(attr){
			var params, param;
			try{
				params = evalParamsWithBindingList(attr, viewModelBinding);
			}catch(e){
				param = evalParamWithBindingList(attr, viewModelBinding);
			}
			if(params){
				// There are some widget parameters that needs to be provided at the time of creation
				var s,
					initialParams = {},
					initialParamsBinding = new bind.Object(initialParams);
				for(s in params){
					if(!/^on/.test(s) && s != foreachParam){
						initialParamsBinding.get(s).to(params[s]);
					}
				}
				delete initialParams._binding; // Make sure _WidgetBase code does not mix in _binding to the widget being created
				this.object = new clz(initialParams, element);
				for(s in params){
					if(/^on/.test(s)){
						this.object.on(s.substr(2), getListenerWithBinding(viewModelBinding, this, params[s]));
					}else if(s != foreachParam){
						this.get(s).to(params[s]);
					}
				}
				var collection = params[foreachParam];
				collection && this.use(bind.parent, viewModelBinding).foreach(collection);
			}else if(param){
				this.object = new clz({}, element);
				this.to(param);
			}
		}else{
			this.object = new clz({}, element);
		}
		var object = this.object;
		if(object){
			object._binding = this;
			this.own({
				remove: function(){
					(object || {})._binding = null;
				}
			}, object);
		}
		return bind.isContainer(element) ? this.parse() : this;
	};

	bind.register(function(object){
		var w,
			isElement = (object || {}).getAttribute,
			typeAttr = isElement && object.getAttribute(dataBindTypeAttr),
			clz;
		try{
			clz = typeAttr && require(typeAttr);
		}catch(e){}
		return !object || object._binding ? undef :
			object._blankGif ? new WidgetBinding(object) :
			(w = isElement && registry.byNode(object)) ? new WidgetBinding(w) :
			clz && clz.prototype._blankGif ? new DeclaredWidgetBinding(object) :
			undef;
	});

	bind.destroy = function(element){
		for(var list = [element].concat([].slice.call(element.getElementsByTagName("*"), 0)), i = 0, l = list.length; i < l; ++i){
			var w = registry.byNode(list[i]);
			if((w || {})._binding){
				w._binding.destroy();
			}else if(list[i]._binding){
				list[i]._binding.destroy();
			}
		}
	};

	return bind;
});
