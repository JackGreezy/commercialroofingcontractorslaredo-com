(function( $ ) {
  $.fn.beforeTrigger = function(eventName, workToBeDoneFirst, workDoneCallback) {
    var isDone = false;

    this.on(eventName, function(e) {
      if (isDone === true) {
        isDone = false;
        workDoneCallback && workDoneCallback.apply(this);
        return;
      }
      
      // capture target to re-fire event at
      var $target = $(this);

      // set up callback for when workToBeDoneFirst has completed
      var successfullyCompleted = function() {
        isDone = true;
        $target.trigger(e.type);
      };
      
      e.preventDefault();

      // execute workToBeDoneFirst callback
      var workResult = workToBeDoneFirst.apply(this);

      // check if workToBeDoneFirst returned a promise
      if ($.isFunction(workResult.then)) {
        workResult.then(successfullyCompleted);
      } else {
        successfullyCompleted();
      }
    });

    return this;
  };
}(jQuery));
(function (Drupal, $) {
  $(window).bind('load', function(){
    $('#webform-submission-contact-node-6-add-form').removeClass('unloaded');
    $('.js-form-item.js-form-item-reason-for-contact label').click(function(){
      $(this).prev('.form-radio').trigger('click');
    });
    $('.js-form-item.js-form-item-reason-for-contact label').beforeTrigger('click', 
      function(){
        var label = $(this);
        var nostep = "#webform-submission-contact-node-6-add-form ." + label.prev('input').val() + "-no-step";
        var step1 = "#webform-submission-contact-node-6-add-form ." + label.prev('input').val() + "-step-1";
        var step2 = "#webform-submission-contact-node-6-add-form ." + label.prev('input').val() + "-step-2";
        $(nostep).removeClass('stayHid');
        $(step1).removeClass('stayHid');
        $(step2).removeClass('stayHid');
        $('#webform-submission-contact-node-6-add-form .step-2').removeClass('stayHid');
        $(step2).addClass('stayHid');
        if($(step2).length){
          $('#webform-submission-contact-node-6-add-form .step-2').addClass('stayHid');
        }
        $(step1+' .next-step').on('click',function(e){
          e.preventDefault();
          var allReqs = true;
          $(step1+' .required').each(function(){
            if(!$(this).val()){
              allReqs = false;
            }
          });
          if($(step1+'.required').length && $(step1+'.required input[type=checkbox]').length){
            allReqs = false
            $(step1+'.required').each(function(){
              if($(this).find('input[type=checkbox]:checked').length > 0){
                allReqs = true;
              }
            });
          }
          if(allReqs){
            $(step1).addClass('stayHid');
            $(step2).removeClass('stayHid');
            $('#webform-submission-contact-node-6-add-form .step-2').removeClass('stayHid');
            $(this).off('click');
          }
        });
        return this;
      },function(){
		return this;
      });                         
  });
})(Drupal, jQuery);