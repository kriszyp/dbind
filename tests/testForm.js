define(['dbind/bind', 'dbind/Validator', 'put-selector/put'], function(bind, Validator, put){
	var get = bind.get;
	myObject = {quantity: 3, price: 5, discounted: true, color: "red", pattern: "striped"};
	return function(form){
		// TODO: put this in a model module
		var quantity = get(myObject, 'quantity').to(
				new Validator({type:"number", maximum: 20, minimum: 10}));
		
		
		quantity.get("title").is("Quantity");
		
		function ValidationTextBox(){
			var mainElement = put('div');
			var binding = new bind.Container(mainElement);
			// the label
			binding.get('title').to(bind(put(mainElement, 'label')));
			// the main value is bound to the input
			binding.to(put(mainElement, 'input[type=text]'));
			// any errors go after it
			binding.get('error').to(put(mainElement, 'span.error-message'));
			return mainElement;
		}
		// create the form elements
		var quantityRow = put(form, 'div');
		var quantityTextBox = ValidationTextBox();
		put(quantityRow, quantityTextBox);
		quantity.to(quantityTextBox);
		
		bind(myObject, "price").to(put(form, "div", "Price", "input[type=text]"));
		
		bind(myObject, "discounted").to(put(form, "div", "Discounted", "input[type=checkbox]"));
		
		var patternSelect = put(form, "div", "Pattern", "select");
		put(patternSelect, "option[value=striped]", "Striped");
		put(patternSelect, "option[value=solid]", "Solid");
		bind(myObject, "pattern").to(patternSelect);
		
		var colorDiv = put(form, "div", "Color");
		var colorProperty = bind(myObject, "color");
		colorProperty.to(put(colorDiv, "div", "Red", "input[type=radio][value=red]"));
		colorProperty.to(put(colorDiv, "div", "Green", "input[type=radio][value=green]"));
		colorProperty.to(put(colorDiv, "div", "Blue", "input[type=radio][value=blue]"));

		bind([quantity, bind(myObject, "price"), bind(myObject, "discounted")]).toArgs(function(quantity, price, discounted){
			return "$" + quantity * price * (discounted ? 0.9 : 1);
		}).to(put(form, 'div label', 'Total Price: ', '< span'));
	}
});