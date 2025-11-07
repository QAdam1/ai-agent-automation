@ai @smoke
Feature: Example ecommerce checkout
  Scenario: Guest buys one item
    Given I am on the homepage
    When I search for "ribeye"
    And I add the first result to the cart
    Then I should see "Thank you for your order"
